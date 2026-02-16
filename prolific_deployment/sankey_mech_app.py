#!/usr/bin/env python3
"""Desktop Sankey builder for mechanical engineering flow balances."""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from pathlib import Path
import tkinter as tk
from tkinter import filedialog, messagebox, ttk

import matplotlib

matplotlib.use("TkAgg")
from matplotlib.backends.backend_tkagg import FigureCanvasTkAgg
from matplotlib.figure import Figure
from matplotlib.sankey import Sankey


ORIENTATION_TO_VALUE = {
    "Top (+1)": 1,
    "Neutral (0)": 0,
    "Bottom (-1)": -1,
}
VALUE_TO_ORIENTATION = {value: label for label, value in ORIENTATION_TO_VALUE.items()}


@dataclass
class FlowItem:
    label: str
    value: float
    orientation: int


PRESETS = {
    "Engine energy balance (kW)": {
        "title": "Internal Combustion Engine Energy Balance",
        "unit": "kW",
        "flows": [
            FlowItem("Fuel energy input", 100.0, 1),
            FlowItem("Shaft output", -32.0, 0),
            FlowItem("Coolant losses", -28.0, -1),
            FlowItem("Exhaust losses", -35.0, -1),
            FlowItem("Radiation + convection", -5.0, -1),
        ],
    },
    "Pump + motor system (kW)": {
        "title": "Pump and Motor Power Balance",
        "unit": "kW",
        "flows": [
            FlowItem("Electrical input", 55.0, 1),
            FlowItem("Hydraulic output", -38.0, 0),
            FlowItem("Motor losses", -9.0, -1),
            FlowItem("Pump internal losses", -6.0, -1),
            FlowItem("Mechanical losses", -2.0, -1),
        ],
    },
    "Compressor station (kW)": {
        "title": "Compressed Air Station Power Balance",
        "unit": "kW",
        "flows": [
            FlowItem("Grid power input", 120.0, 1),
            FlowItem("Compressed air output", -78.0, 0),
            FlowItem("After-cooler heat rejection", -24.0, -1),
            FlowItem("Motor + drive losses", -14.0, -1),
            FlowItem("Leakage + line losses", -4.0, -1),
        ],
    },
}


GUIDE_TEXT = """General Purpose Sankey Builder (Mechanical Engineering)

What this tool is for
- Visualize where power/energy/mass enters and leaves a system.
- Build first-pass balance diagrams for reports and design reviews.

Core rule
- Positive values are inflows.
- Negative values are outflows.
- A balanced diagram sums to zero.

How to use
1) Set chart title and unit (kW, W, kJ/s, kg/s, etc.).
2) Add each flow with label, numeric value, and orientation.
3) Click "Plot / Refresh Sankey".
4) Export the chart to PNG or save your model to JSON.

Notes
- If Auto-balance is enabled and the sum is not zero, a residual flow is added automatically.
- Normalized width keeps the chart readable when magnitudes vary greatly.
- Presets are examples only; replace values with your own measurements/calculations.

Recommended workflow
- Start with one major input and all known outputs.
- Enable auto-balance to estimate unknown losses.
- Replace residual with measured/estimated loss terms once available.
"""


class SankeyMechanicalApp:
    def __init__(self, root: tk.Tk) -> None:
        self.root = root
        self.root.title("Mechanical Sankey Builder")
        self.root.geometry("1250x780")
        self.root.minsize(1080, 680)

        self.title_var = tk.StringVar(value="Mechanical System Flow Balance")
        self.unit_var = tk.StringVar(value="kW")
        self.auto_balance_var = tk.BooleanVar(value=True)
        self.normalize_var = tk.BooleanVar(value=True)
        self.residual_label_var = tk.StringVar(value="Residual / Unaccounted")
        self.preset_var = tk.StringVar(value=next(iter(PRESETS)))

        self.flow_label_var = tk.StringVar()
        self.flow_value_var = tk.StringVar()
        self.flow_orientation_var = tk.StringVar(value="Neutral (0)")
        self.status_var = tk.StringVar(value="Ready.")

        self.figure = Figure(figsize=(8, 6), dpi=100)
        self.ax = self.figure.add_subplot(111)
        self.canvas: FigureCanvasTkAgg | None = None

        self._build_menu()
        self._build_layout()
        self.apply_preset()

    def _build_menu(self) -> None:
        menu = tk.Menu(self.root)
        self.root.config(menu=menu)

        file_menu = tk.Menu(menu, tearoff=0)
        file_menu.add_command(label="New Model", command=self.clear_model)
        file_menu.add_command(label="Load Model JSON...", command=self.load_model)
        file_menu.add_command(label="Save Model JSON...", command=self.save_model)
        file_menu.add_separator()
        file_menu.add_command(label="Export PNG...", command=self.export_png)
        file_menu.add_separator()
        file_menu.add_command(label="Exit", command=self.root.quit)
        menu.add_cascade(label="File", menu=file_menu)

        help_menu = tk.Menu(menu, tearoff=0)
        help_menu.add_command(label="How To Use", command=self.show_guide_popup)
        menu.add_cascade(label="Help", menu=help_menu)

    def _build_layout(self) -> None:
        paned = ttk.Panedwindow(self.root, orient=tk.HORIZONTAL)
        paned.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)

        left = ttk.Frame(paned, padding=8)
        right = ttk.Frame(paned, padding=8)
        paned.add(left, weight=2)
        paned.add(right, weight=3)

        notebook = ttk.Notebook(left)
        notebook.pack(fill=tk.BOTH, expand=True)

        model_tab = ttk.Frame(notebook, padding=8)
        guide_tab = ttk.Frame(notebook, padding=8)
        notebook.add(model_tab, text="Model")
        notebook.add(guide_tab, text="Guide")

        self._build_model_tab(model_tab)
        self._build_guide_tab(guide_tab)
        self._build_plot_area(right)

        status = ttk.Label(self.root, textvariable=self.status_var, anchor="w")
        status.pack(fill=tk.X, padx=10, pady=(0, 8))

    def _build_model_tab(self, parent: ttk.Frame) -> None:
        metadata = ttk.LabelFrame(parent, text="Diagram Setup", padding=8)
        metadata.pack(fill=tk.X, padx=2, pady=(2, 10))

        ttk.Label(metadata, text="Title").grid(row=0, column=0, sticky="w")
        ttk.Entry(metadata, textvariable=self.title_var, width=48).grid(
            row=0, column=1, sticky="ew", padx=(8, 0)
        )

        ttk.Label(metadata, text="Unit").grid(row=1, column=0, sticky="w", pady=(6, 0))
        ttk.Entry(metadata, textvariable=self.unit_var, width=16).grid(
            row=1, column=1, sticky="w", padx=(8, 0), pady=(6, 0)
        )
        metadata.columnconfigure(1, weight=1)

        editor = ttk.LabelFrame(parent, text="Flow Editor", padding=8)
        editor.pack(fill=tk.X, padx=2, pady=(0, 10))

        ttk.Label(editor, text="Label").grid(row=0, column=0, sticky="w")
        ttk.Entry(editor, textvariable=self.flow_label_var, width=30).grid(
            row=0, column=1, sticky="ew", padx=(8, 0)
        )

        ttk.Label(editor, text="Value").grid(row=1, column=0, sticky="w", pady=(6, 0))
        ttk.Entry(editor, textvariable=self.flow_value_var, width=16).grid(
            row=1, column=1, sticky="w", padx=(8, 0), pady=(6, 0)
        )

        ttk.Label(editor, text="Orientation").grid(
            row=2, column=0, sticky="w", pady=(6, 0)
        )
        ttk.Combobox(
            editor,
            textvariable=self.flow_orientation_var,
            values=list(ORIENTATION_TO_VALUE.keys()),
            state="readonly",
            width=14,
        ).grid(row=2, column=1, sticky="w", padx=(8, 0), pady=(6, 0))

        add_row = ttk.Frame(editor)
        add_row.grid(row=3, column=0, columnspan=2, sticky="ew", pady=(8, 0))
        ttk.Button(add_row, text="Add Flow", command=self.add_flow).pack(
            side=tk.LEFT, padx=(0, 6)
        )
        ttk.Button(add_row, text="Update Selected", command=self.update_selected_flow).pack(
            side=tk.LEFT, padx=(0, 6)
        )
        ttk.Button(add_row, text="Delete Selected", command=self.delete_selected_flow).pack(
            side=tk.LEFT, padx=(0, 6)
        )
        ttk.Button(add_row, text="Clear Fields", command=self.clear_editor_inputs).pack(
            side=tk.LEFT
        )
        editor.columnconfigure(1, weight=1)

        table_wrap = ttk.LabelFrame(parent, text="Flow List", padding=8)
        table_wrap.pack(fill=tk.BOTH, expand=True, padx=2, pady=(0, 10))

        columns = ("label", "value", "orientation")
        self.flow_tree = ttk.Treeview(
            table_wrap, columns=columns, show="headings", selectmode="browse", height=10
        )
        self.flow_tree.heading("label", text="Label")
        self.flow_tree.heading("value", text="Value")
        self.flow_tree.heading("orientation", text="Orientation")
        self.flow_tree.column("label", width=220, anchor="w")
        self.flow_tree.column("value", width=95, anchor="e")
        self.flow_tree.column("orientation", width=115, anchor="center")
        self.flow_tree.bind("<<TreeviewSelect>>", self.on_tree_select)

        tree_scroll = ttk.Scrollbar(
            table_wrap, orient=tk.VERTICAL, command=self.flow_tree.yview
        )
        self.flow_tree.configure(yscrollcommand=tree_scroll.set)
        self.flow_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        tree_scroll.pack(side=tk.RIGHT, fill=tk.Y)

        options = ttk.LabelFrame(parent, text="Options", padding=8)
        options.pack(fill=tk.X, padx=2, pady=(0, 10))
        ttk.Checkbutton(
            options, text="Auto-balance residual flow", variable=self.auto_balance_var
        ).grid(row=0, column=0, sticky="w")
        ttk.Checkbutton(
            options, text="Normalize diagram width", variable=self.normalize_var
        ).grid(row=1, column=0, sticky="w", pady=(6, 0))

        ttk.Label(options, text="Residual label").grid(row=2, column=0, sticky="w", pady=(6, 0))
        ttk.Entry(options, textvariable=self.residual_label_var, width=30).grid(
            row=3, column=0, sticky="ew", pady=(3, 0)
        )
        options.columnconfigure(0, weight=1)

        action = ttk.LabelFrame(parent, text="Actions", padding=8)
        action.pack(fill=tk.X, padx=2, pady=(0, 4))

        ttk.Label(action, text="Preset").grid(row=0, column=0, sticky="w")
        ttk.Combobox(
            action,
            textvariable=self.preset_var,
            values=list(PRESETS.keys()),
            state="readonly",
            width=32,
        ).grid(row=0, column=1, sticky="w", padx=(8, 8))
        ttk.Button(action, text="Apply Preset", command=self.apply_preset).grid(
            row=0, column=2, sticky="w"
        )

        ttk.Button(action, text="Plot / Refresh Sankey", command=self.plot_sankey).grid(
            row=1, column=0, sticky="w", pady=(10, 0)
        )
        ttk.Button(action, text="Save Model JSON", command=self.save_model).grid(
            row=1, column=1, sticky="w", pady=(10, 0)
        )
        ttk.Button(action, text="Load Model JSON", command=self.load_model).grid(
            row=1, column=2, sticky="w", pady=(10, 0)
        )
        ttk.Button(action, text="Export PNG", command=self.export_png).grid(
            row=1, column=3, sticky="w", pady=(10, 0), padx=(8, 0)
        )
        action.columnconfigure(1, weight=1)

    def _build_guide_tab(self, parent: ttk.Frame) -> None:
        guide = tk.Text(parent, wrap="word", height=20)
        guide.insert("1.0", GUIDE_TEXT)
        guide.configure(state="disabled")

        scroll = ttk.Scrollbar(parent, orient=tk.VERTICAL, command=guide.yview)
        guide.configure(yscrollcommand=scroll.set)
        guide.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scroll.pack(side=tk.RIGHT, fill=tk.Y)

    def _build_plot_area(self, parent: ttk.Frame) -> None:
        container = ttk.LabelFrame(parent, text="Sankey Preview", padding=8)
        container.pack(fill=tk.BOTH, expand=True)
        self.canvas = FigureCanvasTkAgg(self.figure, master=container)
        self.canvas.get_tk_widget().pack(fill=tk.BOTH, expand=True)
        self.ax.text(0.5, 0.5, "Plot a model to see the Sankey diagram.", ha="center", va="center")
        self.ax.axis("off")
        self.canvas.draw_idle()

    def set_status(self, message: str) -> None:
        self.status_var.set(message)

    def clear_editor_inputs(self) -> None:
        self.flow_label_var.set("")
        self.flow_value_var.set("")
        self.flow_orientation_var.set("Neutral (0)")

    def on_tree_select(self, _event: object) -> None:
        selected = self.flow_tree.selection()
        if not selected:
            return
        row = self.flow_tree.item(selected[0], "values")
        self.flow_label_var.set(str(row[0]))
        self.flow_value_var.set(str(row[1]))
        self.flow_orientation_var.set(str(row[2]))

    def _read_editor_flow(self) -> FlowItem | None:
        label = self.flow_label_var.get().strip()
        if not label:
            messagebox.showerror("Invalid flow", "Flow label is required.")
            return None

        value_text = self.flow_value_var.get().strip()
        try:
            value = float(value_text)
        except ValueError:
            messagebox.showerror("Invalid flow", "Flow value must be numeric.")
            return None

        orientation = ORIENTATION_TO_VALUE.get(self.flow_orientation_var.get(), 0)
        return FlowItem(label=label, value=value, orientation=orientation)

    def add_flow(self) -> None:
        flow = self._read_editor_flow()
        if flow is None:
            return
        self._insert_flow_row(flow)
        self.clear_editor_inputs()
        self.set_status(f"Added flow: {flow.label} ({flow.value:g}).")

    def update_selected_flow(self) -> None:
        selected = self.flow_tree.selection()
        if not selected:
            messagebox.showwarning("No selection", "Select a flow row to update.")
            return

        flow = self._read_editor_flow()
        if flow is None:
            return
        self.flow_tree.item(selected[0], values=self._flow_to_row_values(flow))
        self.set_status(f"Updated flow: {flow.label}.")

    def delete_selected_flow(self) -> None:
        selected = self.flow_tree.selection()
        if not selected:
            messagebox.showwarning("No selection", "Select a flow row to delete.")
            return
        self.flow_tree.delete(selected[0])
        self.set_status("Deleted selected flow.")

    def _flow_to_row_values(self, flow: FlowItem) -> tuple[str, str, str]:
        return (
            flow.label,
            f"{flow.value:.6g}",
            VALUE_TO_ORIENTATION.get(flow.orientation, "Neutral (0)"),
        )

    def _insert_flow_row(self, flow: FlowItem) -> None:
        self.flow_tree.insert("", tk.END, values=self._flow_to_row_values(flow))

    def _collect_flows(self) -> list[FlowItem]:
        flows: list[FlowItem] = []
        for item_id in self.flow_tree.get_children():
            label, value_text, orientation_label = self.flow_tree.item(item_id, "values")
            flows.append(
                FlowItem(
                    label=str(label),
                    value=float(value_text),
                    orientation=ORIENTATION_TO_VALUE.get(str(orientation_label), 0),
                )
            )
        return flows

    def clear_model(self) -> None:
        self.title_var.set("Mechanical System Flow Balance")
        self.unit_var.set("kW")
        self.auto_balance_var.set(True)
        self.normalize_var.set(True)
        self.residual_label_var.set("Residual / Unaccounted")
        self.clear_editor_inputs()
        self._clear_flow_rows()
        self.ax.clear()
        self.ax.text(0.5, 0.5, "Plot a model to see the Sankey diagram.", ha="center", va="center")
        self.ax.axis("off")
        if self.canvas is not None:
            self.canvas.draw_idle()
        self.set_status("Cleared model.")

    def _clear_flow_rows(self) -> None:
        for item_id in self.flow_tree.get_children():
            self.flow_tree.delete(item_id)

    def apply_preset(self) -> None:
        preset = PRESETS[self.preset_var.get()]
        self._clear_flow_rows()

        self.title_var.set(preset["title"])
        self.unit_var.set(preset["unit"])
        for flow in preset["flows"]:
            self._insert_flow_row(flow)

        self.set_status(f"Loaded preset: {self.preset_var.get()}.")
        self.plot_sankey()

    def _resolved_flows(self) -> list[FlowItem] | None:
        flows = self._collect_flows()
        if not flows:
            messagebox.showwarning("No flows", "Add at least one flow before plotting.")
            return None

        total = sum(flow.value for flow in flows)
        if abs(total) <= 1e-9:
            return flows

        if self.auto_balance_var.get():
            residual_label = self.residual_label_var.get().strip() or "Residual"
            flows.append(FlowItem(label=residual_label, value=-total, orientation=0))
            return flows

        messagebox.showerror(
            "Unbalanced flows",
            (
                f"Flow sum is {total:.6g}. For a single Sankey diagram, flows must sum to zero.\n"
                "Enable Auto-balance or fix the values manually."
            ),
        )
        return None

    def plot_sankey(self) -> None:
        flows = self._resolved_flows()
        if flows is None:
            return

        numeric_flows = [flow.value for flow in flows]
        labels = [flow.label for flow in flows]
        orientations = [flow.orientation for flow in flows]
        unit = self.unit_var.get().strip()
        scale = 1.0

        if self.normalize_var.get():
            max_abs = max(abs(value) for value in numeric_flows)
            if max_abs > 0:
                scale = 1.0 / max_abs

        self.ax.clear()
        sankey = Sankey(ax=self.ax, scale=scale, unit=unit, format="%.3g")
        sankey.add(flows=numeric_flows, labels=labels, orientations=orientations)
        diagrams = sankey.finish()

        for text in diagrams[0].texts:
            text.set_fontsize(9)

        self.ax.set_title(self.title_var.get().strip() or "Sankey Diagram")
        self.figure.tight_layout()
        if self.canvas is not None:
            self.canvas.draw_idle()
        self.set_status("Rendered Sankey diagram.")

    def _build_model_payload(self) -> dict:
        return {
            "title": self.title_var.get(),
            "unit": self.unit_var.get(),
            "auto_balance": self.auto_balance_var.get(),
            "normalize_width": self.normalize_var.get(),
            "residual_label": self.residual_label_var.get(),
            "flows": [asdict(flow) for flow in self._collect_flows()],
        }

    def save_model(self) -> None:
        path = filedialog.asksaveasfilename(
            title="Save model as JSON",
            defaultextension=".json",
            filetypes=[("JSON file", "*.json"), ("All files", "*.*")],
        )
        if not path:
            return

        payload = self._build_model_payload()
        Path(path).write_text(json.dumps(payload, indent=2), encoding="utf-8")
        self.set_status(f"Saved model: {path}")

    def load_model(self) -> None:
        path = filedialog.askopenfilename(
            title="Load model JSON",
            filetypes=[("JSON file", "*.json"), ("All files", "*.*")],
        )
        if not path:
            return

        try:
            payload = json.loads(Path(path).read_text(encoding="utf-8"))
            self._apply_payload(payload)
        except (json.JSONDecodeError, OSError, ValueError) as exc:
            messagebox.showerror("Failed to load model", str(exc))
            return

        self.set_status(f"Loaded model: {path}")
        self.plot_sankey()

    def _apply_payload(self, payload: dict) -> None:
        self.title_var.set(str(payload.get("title", "Mechanical System Flow Balance")))
        self.unit_var.set(str(payload.get("unit", "kW")))
        self.auto_balance_var.set(bool(payload.get("auto_balance", True)))
        self.normalize_var.set(bool(payload.get("normalize_width", True)))
        self.residual_label_var.set(str(payload.get("residual_label", "Residual / Unaccounted")))

        self._clear_flow_rows()
        flow_payload = payload.get("flows", [])
        if not isinstance(flow_payload, list):
            raise ValueError("'flows' must be a list")

        for entry in flow_payload:
            if not isinstance(entry, dict):
                raise ValueError("Each flow entry must be an object")
            label = str(entry.get("label", "")).strip()
            if not label:
                raise ValueError("Flow label cannot be empty")
            value = float(entry.get("value", 0.0))
            orientation = int(entry.get("orientation", 0))
            if orientation not in VALUE_TO_ORIENTATION:
                orientation = 0
            self._insert_flow_row(FlowItem(label=label, value=value, orientation=orientation))

    def export_png(self) -> None:
        if self.canvas is None:
            return

        path = filedialog.asksaveasfilename(
            title="Export Sankey to PNG",
            defaultextension=".png",
            filetypes=[("PNG image", "*.png"), ("All files", "*.*")],
        )
        if not path:
            return
        self.figure.savefig(path, dpi=220, bbox_inches="tight")
        self.set_status(f"Exported image: {path}")

    def show_guide_popup(self) -> None:
        messagebox.showinfo("How to use", GUIDE_TEXT)


def main() -> None:
    root = tk.Tk()
    app = SankeyMechanicalApp(root)
    app.set_status("Ready. Add or edit flows, then render.")
    root.mainloop()


if __name__ == "__main__":
    main()
