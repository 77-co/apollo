import { emulateInvoke } from '../../helpers.js';

export default {
    async execute() {
        try {
            emulateInvoke('spotify-play');
            return "Playing";
        } catch (err) {
            return "Couldn't play";
        }
    }
}