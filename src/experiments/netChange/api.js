"use strict";
/* exported netChange */
/* global Cc, Ci, Components, EventManager, ExtensionAPI, Services, ExtensionCommon */
let Cu4 = Components.utils;
Cu4.import("resource://gre/modules/Services.jsm");
Cu4.import("resource://gre/modules/ExtensionCommon.jsm");


var {EventManager} = ExtensionCommon;
let gNetworkLinkService= Cc["@mozilla.org/network/network-link-service;1"]
  .getService(Ci.nsINetworkLinkService);

let last_event = Date.now();

var netChange = class netChange extends ExtensionAPI { 
  getAPI(context) {
    return {
      experiments: {
        netChange: {
          onConnectionChanged: new EventManager({
            context,
            name: "netChange.onConnectionChanged",
            register: fire => {
              let observer = async (subject, topic, data) => {
                // if we get "up" event we should fire an event.
                if (data === "up") {
                  last_event = Date.now();
                  fire.async(data);
                }

                if (data === "changed") {
                  // We will coalesce event that are less than 30s apart.
                  if ( Date.now() - last_event > 30000 &&  gNetworkLinkService.linkStatusKnown && gNetworkLinkService.isLinkUp) {
                    last_event = Date.now();
                    fire.async(data);
                  }
                }
              };

              Services.obs.addObserver(observer, "network:link-status-changed");
              return () => {
                Services.obs.removeObserver(observer, "network:link-status-changed");
              };
            }
          }).api()
        }
      }
    };
  }
};
