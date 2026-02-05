import React from "react";
import ReactDOM from "react-dom/client";
import { MantineProvider, createTheme } from "@mantine/core";
import "@mantine/core/styles.css";

import { App } from "./ui/App";
import "./ui/styles.css";

const theme = createTheme({
  fontFamily: "Sora, Space Grotesk, Segoe UI, Tahoma, Geneva, Verdana, sans-serif",
  headings: {
    fontFamily: "Orbitron, Sora, Space Grotesk, Segoe UI, sans-serif",
    fontWeight: "600",
  },
  primaryColor: "aurora",
  defaultRadius: "lg",
  colors: {
    aurora: [
      "#e8fffe",
      "#bdf8f4",
      "#91f0ea",
      "#65e7e0",
      "#43ddd8",
      "#2dd3cf",
      "#21b8b5",
      "#199693",
      "#117472",
      "#095150",
    ],
    plasma: [
      "#eff2ff",
      "#d8defc",
      "#c0caf7",
      "#a8b6f2",
      "#90a2ed",
      "#788ee8",
      "#5f74cc",
      "#49599f",
      "#333f73",
      "#1f2647",
    ],
    ember: [
      "#fff5ea",
      "#ffe6c8",
      "#ffd5a5",
      "#ffc483",
      "#ffb462",
      "#f8a443",
      "#d48834",
      "#a56a27",
      "#764a1b",
      "#472a10",
    ],
  },
  components: {
    Card: {
      styles: {
        root: {
          background: "linear-gradient(180deg, rgba(14, 24, 45, 0.92) 0%, rgba(8, 16, 34, 0.92) 100%)",
          border: "1px solid rgba(94, 145, 190, 0.34)",
          boxShadow: "0 18px 40px rgba(3, 8, 22, 0.5), inset 0 1px 0 rgba(210, 246, 255, 0.08)",
          backdropFilter: "blur(10px)",
        },
      },
    },
    Button: {
      styles: {
        root: {
          textTransform: "none",
          fontWeight: 600,
          letterSpacing: "0.015em",
          border: "1px solid rgba(121, 205, 229, 0.35)",
          boxShadow: "0 0 0 1px rgba(11, 66, 97, 0.3)",
          transition: "transform 120ms ease, box-shadow 180ms ease, border-color 180ms ease",
        },
      },
    },
    AppShell: {
      styles: {
        header: {
          borderBottom: "1px solid rgba(113, 167, 208, 0.35)",
        },
        navbar: {
          borderRight: "1px solid rgba(113, 167, 208, 0.35)",
        },
      },
    },
    Badge: {
      styles: {
        root: {
          textTransform: "none",
          letterSpacing: "0.03em",
          border: "1px solid rgba(127, 183, 223, 0.3)",
          backdropFilter: "blur(8px)",
        },
      },
    },
    NavLink: {
      styles: {
        root: {
          borderRadius: 14,
          border: "1px solid transparent",
          transition: "border-color 160ms ease, background-color 160ms ease, transform 160ms ease",
        },
        label: {
          fontWeight: 600,
          letterSpacing: "0.02em",
        },
      },
    },
    Tabs: {
      styles: {
        tab: {
          borderRadius: 12,
          border: "1px solid rgba(109, 162, 204, 0.2)",
          "&[data-active]": {
            background: "linear-gradient(180deg, rgba(44, 87, 140, 0.44) 0%, rgba(17, 52, 96, 0.42) 100%)",
            borderColor: "rgba(120, 197, 237, 0.55)",
          },
        },
      },
    },
    TextInput: {
      styles: {
        input: {
          backgroundColor: "rgba(15, 27, 49, 0.88)",
          borderColor: "rgba(112, 165, 207, 0.35)",
          color: "var(--ag-text)",
        },
      },
    },
    NumberInput: {
      styles: {
        input: {
          backgroundColor: "rgba(15, 27, 49, 0.88)",
          borderColor: "rgba(112, 165, 207, 0.35)",
          color: "var(--ag-text)",
        },
      },
    },
    Textarea: {
      styles: {
        input: {
          backgroundColor: "rgba(15, 27, 49, 0.88)",
          borderColor: "rgba(112, 165, 207, 0.35)",
          color: "var(--ag-text)",
        },
      },
    },
    Select: {
      styles: {
        input: {
          backgroundColor: "rgba(15, 27, 49, 0.88)",
          borderColor: "rgba(112, 165, 207, 0.35)",
          color: "var(--ag-text)",
        },
        dropdown: {
          background: "rgba(8, 14, 30, 0.96)",
          borderColor: "rgba(122, 184, 228, 0.34)",
          backdropFilter: "blur(12px)",
        },
      },
    },
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <MantineProvider theme={theme} defaultColorScheme="dark">
      <App />
    </MantineProvider>
  </React.StrictMode>,
);
