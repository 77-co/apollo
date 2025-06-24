import settings from "../../../settings/settings.js";
import { emulateInvoke } from "../../helpers.js";

export default {
    async execute({ city }) {
        try {
            settings.set("ai.city", city);
            emulateInvoke("load-settings");
            return "Done.";
        } catch (err) {
            return "Failed.";
        }
    }
}