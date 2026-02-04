import { useState } from "react";

export function useTextInput(initialValue = "") {
  const [value, setValue] = useState(initialValue);
  const reset = () => setValue(initialValue);

  return { value, setValue, reset };
}
