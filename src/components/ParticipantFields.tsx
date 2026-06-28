import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type ParticipantData = {
  full_name: string;
  email: string;
  cpf?: string | null;
  rg?: string | null;
  rg_issuer?: string | null;
  birth_date?: string | null;
  phone?: string | null;
  address_zip?: string | null;
  address_street?: string | null;
  address_number?: string | null;
  address_district?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  university_id?: string | null;
  course_name?: string | null;
};

export const REGIONS_REQUIRING_CARAVAN = ["norte", "sul"];

export function ParticipantFields({
  value,
  onChange,
  requireCaravan,
  disabled,
}: {
  value: ParticipantData;
  onChange: (next: ParticipantData) => void;
  requireCaravan: boolean;
  disabled?: boolean;
}) {
  const f = <K extends keyof ParticipantData>(k: K, v: ParticipantData[K]) =>
    onChange({ ...value, [k]: v });
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1">
        <Label>Nome completo *</Label>
        <Input
          value={value.full_name}
          onChange={(e) => f("full_name", e.target.value)}
          required
          disabled={disabled}
        />
      </div>
      <div className="space-y-1">
        <Label>E-mail *</Label>
        <Input
          type="email"
          value={value.email}
          onChange={(e) => f("email", e.target.value)}
          required
          disabled={disabled}
        />
      </div>
      {requireCaravan && (
        <>
          <div className="space-y-1">
            <Label>CPF *</Label>
            <Input
              value={value.cpf ?? ""}
              onChange={(e) => f("cpf", e.target.value)}
              required
              disabled={disabled}
            />
          </div>
          <div className="space-y-1">
            <Label>Data de nascimento *</Label>
            <Input
              type="date"
              value={value.birth_date ?? ""}
              onChange={(e) => f("birth_date", e.target.value)}
              required
              disabled={disabled}
            />
          </div>
          <div className="space-y-1">
            <Label>RG *</Label>
            <Input
              value={value.rg ?? ""}
              onChange={(e) => f("rg", e.target.value)}
              required
              disabled={disabled}
            />
          </div>
          <div className="space-y-1">
            <Label>Órgão emissor *</Label>
            <Input
              value={value.rg_issuer ?? ""}
              onChange={(e) => f("rg_issuer", e.target.value)}
              required
              disabled={disabled}
            />
          </div>
          <div className="space-y-1">
            <Label>Telefone (DDD) *</Label>
            <Input
              value={value.phone ?? ""}
              onChange={(e) => f("phone", e.target.value)}
              required
              disabled={disabled}
            />
          </div>
          <div className="space-y-1">
            <Label>CEP *</Label>
            <Input
              value={value.address_zip ?? ""}
              onChange={(e) => f("address_zip", e.target.value)}
              required
              disabled={disabled}
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label>Rua *</Label>
            <Input
              value={value.address_street ?? ""}
              onChange={(e) => f("address_street", e.target.value)}
              required
              disabled={disabled}
            />
          </div>
          <div className="space-y-1">
            <Label>Número *</Label>
            <Input
              value={value.address_number ?? ""}
              onChange={(e) => f("address_number", e.target.value)}
              required
              disabled={disabled}
            />
          </div>
          <div className="space-y-1">
            <Label>Bairro *</Label>
            <Input
              value={value.address_district ?? ""}
              onChange={(e) => f("address_district", e.target.value)}
              required
              disabled={disabled}
            />
          </div>
          <div className="space-y-1">
            <Label>Contato de emergência — nome *</Label>
            <Input
              value={value.emergency_contact_name ?? ""}
              onChange={(e) => f("emergency_contact_name", e.target.value)}
              required
              disabled={disabled}
            />
          </div>
          <div className="space-y-1">
            <Label>Contato de emergência — tel. (DDD) *</Label>
            <Input
              value={value.emergency_contact_phone ?? ""}
              onChange={(e) => f("emergency_contact_phone", e.target.value)}
              required
              disabled={disabled}
            />
          </div>
          <div className="space-y-1">
            <Label>Matrícula da Faculdade *</Label>
            <Input
              value={value.university_id ?? ""}
              onChange={(e) => f("university_id", e.target.value)}
              required
              disabled={disabled}
            />
          </div>
          <div className="space-y-1">
            <Label>Nome do curso *</Label>
            <Input
              value={value.course_name ?? ""}
              onChange={(e) => f("course_name", e.target.value)}
              required
              disabled={disabled}
            />
          </div>
        </>
      )}
    </div>
  );
}

export const emptyParticipant = (): ParticipantData => ({
  full_name: "",
  email: "",
  cpf: "",
  rg: "",
  rg_issuer: "",
  birth_date: "",
  phone: "",
  address_zip: "",
  address_street: "",
  address_number: "",
  address_district: "",
  emergency_contact_name: "",
  emergency_contact_phone: "",
  university_id: "",
  course_name: "",
});

export function validateCaravan(p: ParticipantData): string | null {
  const need: (keyof ParticipantData)[] = [
    "cpf",
    "birth_date",
    "rg",
    "rg_issuer",
    "phone",
    "address_zip",
    "address_street",
    "address_number",
    "address_district",
    "emergency_contact_name",
    "emergency_contact_phone",
    "university_id",
    "course_name",
  ];
  for (const k of need) if (!p[k]) return `Preencha o campo ${k}`;
  return null;
}
