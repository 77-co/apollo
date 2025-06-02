import Store from "electron-store";
import validators from "./validators.js";

const store = new Store();

// This object defines validators for each option in the config file.
// If a key isn't in this object, it cannot be changed as a setting.
const values = {
    "speech.enabled": { validator: validators.bool, default: true },
    "speech.voice": { validator: validators.voice, default: "ash" },
    "ui.darkMode": { validator: validators.bool, default: false },
    "ai.realtime": { validator: validators.bool, default: false },
    "ai.name": { validator: validators.string, default: "" },
};

export default {
    set: (key, value) => {
        if (values[key] && values[key].validator(value)) {
            // Add the settings prefix
            key = "settings." + key;

            store.set(key, value);
            return true;
        } else {
            console.error(
                `Setting validation unsuccessful: [${key} ; ${value}]`
            );
            return false;
        }
    },
    get: (key) => {
        if (!values[key]) return undefined;

        const defaultValue = values[key].default;

        key = "settings." + key;
        return store.get(key, defaultValue);
    },
};
