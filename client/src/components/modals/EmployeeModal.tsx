// src/components/modals/EmployeeModal.tsx
import { useState, useEffect } from "react";
import { X, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useCreateEmployee, useUpdateEmployee } from "@/hooks/useSchedule";
import type { Employee, InsertEmployee } from "@shared/schema";

interface EmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee?: Employee;
}

/* Dias da semana exibidos */
const WEEKDAYS = [
  { value: "sunday", label: "Dom" },
  { value: "monday", label: "Seg" },
  { value: "tuesday", label: "Ter" },
  { value: "wednesday", label: "Qua" },
  { value: "thursday", label: "Qui" },
  { value: "friday", label: "Sex" },
  { value: "saturday", label: "Sáb" },
] as const;

export default function EmployeeModal({
  isOpen,
  onClose,
  employee,
}: EmployeeModalProps) {
  const { toast } = useToast();
  const createEmployee = useCreateEmployee();
  const updateEmployee = useUpdateEmployee();

  const [formData, setFormData] = useState<InsertEmployee>({
    name: "",
    workDays: ["monday", "tuesday", "wednesday", "thursday", "friday"],
    defaultStartTime: "08:00",
    defaultEndTime: "18:00",
    isActive: true,
    weekendRotation: false,
    customSchedule: {},
    observations: "",
  });

  /* ---------------------------------------------------------------------- */
  /* sincroniza estado interno sempre que o modal abre / funcionário muda   */
  /* ---------------------------------------------------------------------- */
  useEffect(() => {
    if (employee) {
      setFormData({
        name: employee.name,
        workDays: employee.workDays,
        defaultStartTime: employee.defaultStartTime,
        defaultEndTime: employee.defaultEndTime,
        isActive: employee.isActive,
        weekendRotation: employee.weekendRotation,
        customSchedule: employee.customSchedule,
        observations: employee.observations ?? "",
      });
    } else {
      setFormData({
        name: "",
        workDays: ["monday", "tuesday", "wednesday", "thursday", "friday"],
        defaultStartTime: "08:00",
        defaultEndTime: "18:00",
        isActive: true,
        weekendRotation: false,
        customSchedule: {},
        observations: "",
      });
    }
  }, [employee, isOpen]);

  if (!isOpen) return null;

  /* ---------------------------------------------------------------------- */
  /* Handlers                                                                */
  /* ---------------------------------------------------------------------- */
  const handleWorkDayChange = (day: string, checked: boolean) => {
    setFormData((prev) => {
      const nextDays = checked
        ? [...prev.workDays, day]
        : prev.workDays.filter((d) => d !== day);

      /* se desmarcou, remove horário custom daquele dia */
      const nextCustom = { ...prev.customSchedule };
      if (!checked && nextCustom[day]) delete nextCustom[day];

      return { ...prev, workDays: nextDays, customSchedule: nextCustom };
    });
  };

  const handleCustomTimeChange = (
    day: string,
    field: "startTime" | "endTime",
    value: string
  ) => {
    setFormData((prev) => ({
      ...prev,
      customSchedule: {
        ...prev.customSchedule,
        [day]: {
          ...prev.customSchedule?.[day],
          [field]: value,
        },
      },
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (employee) {
        await updateEmployee.mutateAsync({ id: employee.id, ...formData });
        toast({ title: "Funcionário atualizado" });
      } else {
        await createEmployee.mutateAsync(formData);
        toast({ title: "Funcionário criado" });
      }
      onClose();
    } catch {
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar o funcionário",
        variant: "destructive",
      });
    }
  };

  /* ---------------------------------------------------------------------- */
  /* Render                                                                  */
  /* ---------------------------------------------------------------------- */
  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header -------------------------------------------------------- */}
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold text-gray-900">
              {employee ? "Editar Funcionário" : "Novo Funcionário"}
            </h3>
            <Button size="sm" variant="ghost" onClick={onClose}>
              <X size={20} />
            </Button>
          </div>

          {/* Form ---------------------------------------------------------- */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Nome + Status --------------------------------------------- */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label className="mb-1 block">Nome Completo</Label>
                <Input
                  required
                  value={formData.name}
                  onChange={(e) =>
                    setFormData((f) => ({ ...f, name: e.target.value }))
                  }
                />
              </div>

              <div>
                <Label className="mb-1 block">Status</Label>
                <Select
                  value={formData.isActive.toString()}
                  onValueChange={(v) =>
                    setFormData((f) => ({ ...f, isActive: v === "true" }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Ativo</SelectItem>
                    <SelectItem value="false">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Observações ------------------------------------------------- */}
            <div>
              <Label className="mb-1 block">Observações</Label>
              <Textarea
                placeholder="Ex.: Almoço 13h‑14h"
                value={formData.observations}
                onChange={(e) =>
                  setFormData((f) => ({ ...f, observations: e.target.value }))
                }
              />
            </div>

            {/* Dias de trabalho ------------------------------------------ */}
            <div>
              <Label className="block mb-2">Dias de Trabalho</Label>
              <div className="grid grid-cols-3 md:grid-cols-7 gap-2">
                {WEEKDAYS.map((d) => (
                  <label
                    key={d.value}
                    className="flex items-center space-x-2 p-2 border rounded hover:bg-gray-50"
                  >
                    <Checkbox
                      checked={formData.workDays.includes(d.value)}
                      onCheckedChange={(checked) =>
                        handleWorkDayChange(d.value, !!checked)
                      }
                    />
                    <span className="text-sm">{d.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Horário padrão -------------------------------------------- */}
            <div>
              <Label className="block mb-2">Horário Padrão</Label>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs block mb-1">Início</Label>
                  <Input
                    type="time"
                    value={formData.defaultStartTime}
                    onChange={(e) =>
                      setFormData((f) => ({
                        ...f,
                        defaultStartTime: e.target.value,
                      }))
                    }
                  />
                </div>
                <div>
                  <Label className="text-xs block mb-1">Fim</Label>
                  <Input
                    type="time"
                    value={formData.defaultEndTime}
                    onChange={(e) =>
                      setFormData((f) => ({
                        ...f,
                        defaultEndTime: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>
            </div>

            {/* Horários custom ------------------------------------------- */}
            {formData.workDays.length > 0 && (
              <div>
                <Label className="block mb-2">
                  Horários Personalizados por Dia
                </Label>
                <p className="text-xs text-gray-500 mb-3">
                  Se vazio, será usado o horário padrão.
                </p>
                <div className="space-y-3">
                  {formData.workDays.map((day) => {
                    const info = WEEKDAYS.find((w) => w.value === day)!;
                    const custom = formData.customSchedule?.[day];
                    return (
                      <div
                        key={day}
                        className="flex items-center space-x-4 border p-3 rounded"
                      >
                        <div className="w-12 font-medium">{info.label}</div>
                        <div className="flex-1 grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs block mb-1">Início</Label>
                            <Input
                              type="time"
                              placeholder={formData.defaultStartTime}
                              value={custom?.startTime || ""}
                              onChange={(e) =>
                                handleCustomTimeChange(
                                  day,
                                  "startTime",
                                  e.target.value
                                )
                              }
                            />
                          </div>
                          <div>
                            <Label className="text-xs block mb-1">Fim</Label>
                            <Input
                              type="time"
                              placeholder={formData.defaultEndTime}
                              value={custom?.endTime || ""}
                              onChange={(e) =>
                                handleCustomTimeChange(
                                  day,
                                  "endTime",
                                  e.target.value
                                )
                              }
                            />
                          </div>
                        </div>
                        {(custom?.startTime || custom?.endTime) && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              setFormData((prev) => {
                                const next = { ...prev.customSchedule };
                                delete next[day];
                                return { ...prev, customSchedule: next };
                              })
                            }
                          >
                            <X size={16} />
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Revezamento FDS ------------------------------------------ */}
            <div className="border p-4 rounded bg-yellow-50">
              <label className="flex items-center space-x-3">
                <Checkbox
                  checked={formData.weekendRotation}
                  onCheckedChange={(c) =>
                    setFormData((f) => ({ ...f, weekendRotation: !!c }))
                  }
                />
                <span>Participar do revezamento de fins de semana</span>
              </label>
            </div>

            {/* Ações ------------------------------------------------------ */}
            <div className="flex justify-end space-x-3 border-t pt-6">
              <Button variant="ghost" onClick={onClose}>
                Cancelar
              </Button>
              <Button
                type="submit"
                className="bg-brand hover:bg-brand-dark text-white"
                disabled={createEmployee.isPending || updateEmployee.isPending}
              >
                <Save size={16} className="mr-1" />
                {createEmployee.isPending || updateEmployee.isPending
                  ? "Salvando..."
                  : "Salvar Funcionário"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
