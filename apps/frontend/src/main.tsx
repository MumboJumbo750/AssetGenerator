import React from "react";
import ReactDOM from "react-dom/client";
import { MantineProvider, createTheme } from "@mantine/core";
import "@mantine/core/styles.css";

import { App } from "./ui/App";
import "./ui/styles.css";

const theme = createTheme({
  fontFamily: "Space Grotesk, Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
  headings: { fontFamily: "Space Grotesk, Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif" },
  primaryColor: "neon",
  defaultRadius: "md",
  colors: {
    neon: [
      "#f3efff",
      "#d9ccff",
      "#c2a9ff",
      "#ad86ff",
      "#9b6bff",
      "#8754ff",
      "#7c4dff",
      "#6a3fe6",
      "#5b34c4",
      "#4b2b9f"
    ],
    cyan: [
      "#e6fcff",
      "#c3f6ff",
      "#9fedff",
      "#7ae2ff",
      "#4fd6ff",
      "#2ecbff",
      "#14c2ff",
      "#00b0e6",
      "#0097c4",
      "#007aa0"
    ],
    magenta: [
      "#ffe6ff",
      "#f9c2ff",
      "#f39cff",
      "#ef74ff",
      "#ea4dff",
      "#e427ff",
      "#d80eff",
      "#b300d6",
      "#8c00ad",
      "#650082"
    ]
  },
  components: {
    Card: {
      styles: {
        root: {
          backgroundColor: "var(--ag-surface)",
          border: "1px solid var(--ag-border)",
          boxShadow: "0 0 0 1px rgba(124,77,255,0.08), 0 12px 30px rgba(0,0,0,0.35)"
        }
      }
    },
    Button: {
      styles: {
        root: {
          textTransform: "none",
          boxShadow: "0 0 0 1px rgba(124,77,255,0.2)"
        }
      }
    },
    Badge: {
      styles: {
        root: {
          textTransform: "none",
          letterSpacing: "0.02em"
        }
      }
    },
    NavLink: {
      styles: {
        root: {
          borderRadius: 12
        }
      }
    },
    TextInput: {
      styles: {
        input: {
          backgroundColor: "var(--ag-surface-2)",
          borderColor: "var(--ag-border)"
        }
      }
    },
    NumberInput: {
      styles: {
        input: {
          backgroundColor: "var(--ag-surface-2)",
          borderColor: "var(--ag-border)"
        }
      }
    },
    Textarea: {
      styles: {
        input: {
          backgroundColor: "var(--ag-surface-2)",
          borderColor: "var(--ag-border)"
        }
      }
    },
    Select: {
      styles: {
        input: {
          backgroundColor: "var(--ag-surface-2)",
          borderColor: "var(--ag-border)"
        }
      }
    }
  }
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <MantineProvider theme={theme} defaultColorScheme="dark">
      <App />
    </MantineProvider>
  </React.StrictMode>
);
