import React from "react";
import { NumberInput, Select, SimpleGrid, Switch, TextInput } from "@mantine/core";

type FieldDef =
  | {
      id: string;
      label: string;
      type: "text";
      value: string;
      onChange: (value: string) => void;
    }
  | {
      id: string;
      label: string;
      type: "number";
      value: number;
      min?: number;
      max?: number;
      step?: number;
      onChange: (value: number) => void;
    }
  | {
      id: string;
      label: string;
      type: "switch";
      value: boolean;
      onChange: (value: boolean) => void;
    }
  | {
      id: string;
      label: string;
      type: "select";
      value: string;
      options: Array<{ value: string; label: string }>;
      onChange: (value: string) => void;
    };

export function FormBuilder({ fields }: { fields: FieldDef[] }) {
  return (
    <SimpleGrid cols={{ base: 1, md: 2 }}>
      {fields.map((field) => {
        if (field.type === "text") {
          return (
            <TextInput
              key={field.id}
              label={field.label}
              value={field.value}
              onChange={(event) => field.onChange(event.currentTarget.value)}
            />
          );
        }
        if (field.type === "number") {
          return (
            <NumberInput
              key={field.id}
              label={field.label}
              value={field.value}
              min={field.min}
              max={field.max}
              step={field.step}
              onChange={(value) => field.onChange(Number(value ?? 0))}
            />
          );
        }
        if (field.type === "switch") {
          return (
            <Switch
              key={field.id}
              label={field.label}
              checked={field.value}
              onChange={(event) => field.onChange(event.currentTarget.checked)}
            />
          );
        }
        return (
          <Select
            key={field.id}
            label={field.label}
            data={field.options}
            value={field.value}
            onChange={(value) => field.onChange(value ?? "")}
          />
        );
      })}
    </SimpleGrid>
  );
}
