import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { UNIDADES } from "@/lib/unidades";

interface Props {
  value: string | null | undefined;
  onChange: (value: string) => void;
}

/** Selector del catálogo de unidades. Si el dato viejo no está en el catálogo, se muestra igual. */
export function UnidadSelect({ value, onChange }: Props) {
  const actual = value || "ud.";
  const opciones: string[] = UNIDADES.includes(actual as any) ? [...UNIDADES] : [actual, ...UNIDADES];
  return (
    <Select value={actual} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {opciones.map(u => (
          <SelectItem key={u} value={u}>{u}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
