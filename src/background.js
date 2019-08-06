"use strict";
/* global browser */


const STUDY_URL = browser.extension.getURL("study.html");


const stateManager = {
  _settingName: null,

  set settingName(settingName) {
    if (this._settingName === null) {
      this._settingName = settingName;
    } else {
      throw new Error("already set setting");
    }
  },

  get settingName() {
    if (this._settingName === null) {
      throw new Error("set setting not set");
    } else {
      return this._settingName;
    }
  },

  async getState() {
    return await browser.experiments.settings.get(this.settingName) || null;
  },

  async setState(stateKey) {
    browser.experiments.settings.set(this.settingName, stateKey);
  },

  /* settingName impacts the active states file we will be getting:
     trr-active, trr-study
   */
  async setSetting(settingName) {
    stateManager.settingName = settingName;
    return browser.experiments.settings.add(this.settingName);
  },

  // Clear out settings
  async clear(stateKey = null) {
    browser.experiments.settings.clear(stateKey);
  }
};


const rollout = {
  async init() {
    browser.browserAction.onClicked.addListener(() => {
      this.showTab();
    });
    browser.runtime.onMessage.addListener((...args) => 
      this.handleMessage(...args));
    await this.onReady();
  },
  async showTab() {
    const tabs = await this.findStudyTabs();
    if (tabs.length) {
      browser.tabs.update(tabs[0].id, {
        active: true
      });
    } else {
      browser.tabs.create({
        url: STUDY_URL
      });
    }
  },
  async onReady() {
    // If the user hasn't met the criteria clean up
    //if (await browser.experiments.settings.hasModifiedPrerequisites()) {
    //  stateManager.endStudy("ineligible");
    //}

    // Set the DoH preferences.
    await stateManager.setSetting("trr-active");

    const stateName = await stateManager.getState();
    switch (stateName) {
    case "enabled":
    case "disabled":
    case "UIDisabled":
    case "UIOk":
    case "uninstalled":
    case null:
      await stateManager.setState("loaded");
      await this.show();
      break;
      // If the user has a thrown error show the banner again 
      // (shouldn't happen)
    case "loaded":
      await this.show();
      break;
    }
  },

  async handleMessage(message) {
    switch (message.method) {
    case "UIDisable":
      await this.handleUIDisable();
      break;
    case "UIOK":
      await this.handleUIOK();
      break;
    }
  },

  async handleUIOK() {
    await stateManager.setState("UIOk");
    browser.experiments.notifications.clear("rollout-prompt");
  },

  findStudyTabs() {
    return browser.tabs.query({
      url: STUDY_URL
    });
  },

  async handleUIDisable() {
    const tabs = await this.findStudyTabs();
    browser.tabs.remove(tabs.map((tab) => tab.id));
    browser.experiments.notifications.clear("rollout-prompt");
  },

  async show() {
    // This doesn't handle the 'x' clicking on the notification 
    // mostly because it's not clear what the user intended here.
    browser.experiments.notifications.onButtonClicked.addListener((options) => {
      switch (Number(options.buttonIndex)) {
      case 1:
        this.handleUIOK();
        break;
      case 0:
        this.handleUIDisable();
        break;
      }
    });
    browser.experiments.notifications.create("rollout-prompt", {
      type: "prompt",
      title: "",
      message: "notificationMessage",
      buttons: [
        {title: "disableButtonText"},
        {title: "acceptButtonText"}
      ],
      moreInfo: {
        url: STUDY_URL,
        title: "learnMoreLinkText"
      }
    });
    // Set enabled state last in-case the code above fails.
    await stateManager.setState("enabled");
  }
};


// Test ping
const bucket = "doh-rollout";
const options = {addClientId: true, addEnvironment: true};
const data = {"foo": "bar"};
const payload = {
  type: bucket,
  data,
  testing: true
};
browser.telemetry.submitPing(bucket, payload, options);


rollout.init();
