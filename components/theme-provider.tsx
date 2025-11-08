import React, { createContext, useContext, ReactNode } from "react";
import { useColorScheme } from "react-native";
import { DarkTheme, DefaultTheme, Theme } from "@react-navigation/native";

type ThemeContextType = {
    theme: Theme;
    colorScheme: "light" | "dark" | null | undefined;
};

const ThemeContext = createContext<ThemeContextType>({
    theme: DefaultTheme,
    colorScheme: "light",
});

export const useTheme = () => useContext(ThemeContext);

type ThemeProviderProps = {
    children: ReactNode;
};

export const ThemeProvider = ({ children }: ThemeProviderProps) => {
    const colorScheme = useColorScheme();
    const theme = colorScheme === "dark" ? DarkTheme : DefaultTheme;

    return (
        <ThemeContext.Provider value={{ theme, colorScheme }}>
            {children}
        </ThemeContext.Provider>
    );
};
