export default {
    bool: (val) => typeof val === "boolean",
    string: (val) => typeof val === "string",
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
    positiveInt: (val) => !isNaN(val) && val > 0,
    themeColor: (val) => {
        const colors = [
            "blue",
            "purple",
            "pink",
            "red",
            "orange",
            "yellow",
            "green",
        ];

        return colors.includes(val);
    },
};