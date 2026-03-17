declare const _default: {
    content: string[];
    theme: {
        extend: {
            colors: {
                ink: {
                    950: string;
                    900: string;
                    800: string;
                };
                gold: {
                    200: string;
                    300: string;
                    400: string;
                };
                felt: {
                    900: string;
                    800: string;
                    700: string;
                };
            };
            fontFamily: {
                display: [string, string];
                body: [string, string];
            };
            boxShadow: {
                glow: string;
                card: string;
                felt: string;
            };
            backgroundImage: {
                "hero-grid": string;
            };
            animation: {
                float: string;
                pulseSoft: string;
            };
            keyframes: {
                float: {
                    "0%, 100%": {
                        transform: string;
                    };
                    "50%": {
                        transform: string;
                    };
                };
                pulseSoft: {
                    "0%, 100%": {
                        opacity: string;
                        transform: string;
                    };
                    "50%": {
                        opacity: string;
                        transform: string;
                    };
                };
            };
        };
    };
    plugins: never[];
};
export default _default;
