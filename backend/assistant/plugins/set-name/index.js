import settings from "../../../settings/settings.js";
import { emulateInvoke } from "../../helpers.js";

export default {
    async execute({ name }) {
        try {
            settings.set("ai.name", name);
            emulateInvoke("load-settings");
            return "Done.";
        } catch (err) {
            return "Failed.";
        }
    }
}