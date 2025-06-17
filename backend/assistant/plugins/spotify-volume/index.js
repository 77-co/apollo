import { emulateInvoke } from '../../helpers.js';

export default {
    async execute({
        volume,
    }) {
        try {
            emulateInvoke('spotify-set-volume', volume);
            return "Volume set to " + volume;
        } catch (err) {
            return "Couldn't set volume";
        }
    }
}