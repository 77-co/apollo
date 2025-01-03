import Store from "electron-store";

const store = new Store();

export function getIntegrations() {
    return store.get('integrations', {});
}

export function setIntegration(integration, data) {
    store.set(`integrations.${integration}`, data);
}