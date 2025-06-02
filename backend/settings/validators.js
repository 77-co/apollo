export default {
    bool: (val) => {
        return typeof val === "boolean";
    },
    string: (val) => {
        return typeof val === "string";
    },
    voice: (val) => {
        const voices = [
            "alloy",
            "ash",
            "ballad",
            "coral",
            "echo",
            "fable",
            "onyx",
            "nova",
            "sage",
            "shimmer",
            "verse",
        ];
        return voices.includes(val);
    },
};
