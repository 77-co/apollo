import { emulateInvoke } from '../../helpers.js';

export default {
    async execute() {
        try {
            emulateInvoke('spotify-pause');
            return "Paused";
        } catch (err) {
            return "Couldn't pause";
        }
    }
}