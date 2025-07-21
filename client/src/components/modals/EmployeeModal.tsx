// client/src/components/modals/EmployeeModal.tsx
import { useState, useEffect } from "react";
import { X, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useCreateEmployee, useUpdateEmployee } from "@/hooks/useSchedule";
import type { Employee, InsertEmployee } from "@shared/schema";

interface EmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee?: Employee;
}

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
    notes: "",
  });

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
        notes: employee.notes || "",
      });
    }
  }, [employee, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (employee) {
        await updateEmployee.mutateAsync({ id: employee.id, ...formData });
        toast({
          title: "Funcionário atualizado",
          description: "Funcionário foi atualizado com sucesso",
        });
      } else {
        await createEmployee.mutateAsync(formData);
        toast({
          title: "Funcionário criado",
          description: "Funcionário foi criado com sucesso",
        });
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

  const handleWorkDayChange = (
    day: (typeof WEEKDAYS)[number]["value"],
    checked: boolean
  ) => {
    setFormData((prev) => {
      const newWorkDays = checked
        ? [...prev.workDays, day]
        : prev.workDays.filter((d) => d !== day);
      const newCustom = { ...prev.customSchedule };
      if (!checked && newCustom[day]) {
        delete newCustom[day];
      }
      return {
        ...prev,
        workDays: newWorkDays,
        customSchedule: newCustom,
      };
    });
  };

  const handleCustomScheduleChange = (
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

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const isLoading = createEmployee.isPending || updateEmployee.isPending;

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-gray-900">
              {employee ? "Editar Funcionário" : "Novo Funcionário"}
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X size={20} />
            </Button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Nome e Status */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label className="block text-sm font-medium text-gray-700 mb-2">
                  Nome Completo
                </Label>
                <Input
                  type="text"
                  required
                  placeholder="Ex: João Silva"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, name: e.target.value }))
                  }
                />
              </div>
              <div>
                <Label className="block text-sm font-medium text-gray-700 mb-2">
                  Status
                </Label>
                <Select
                  value={formData.isActive.toString()}
                  onValueChange={(value) =>
                    setFormData((prev) => ({
                      ...prev,
                      isActive: value === "true",
                    }))
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

            {/* Observações */}
            <div>
              <Label className="block text-sm font-medium text-gray-700 mb-2">
                Observações
              </Label>
              <Textarea
                placeholder="Detalhes adicionais sobre este funcionário…"
                value={formData.notes}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, notes: e.target.value }))
                }
                rows={3}
              />
            </div>

            {/* Dias de Trabalho */}
            <div>
              <Label className="block text-sm font-medium text-gray-700 mb-3">
                Dias de Trabalho
              </Label>
              <div className="grid grid-cols-3 md:grid-cols-7 gap-2">
                {WEEKDAYS.map((day) => (
                  <label
                    key={day.value}
                    className="flex items-center space-x-2 p-3 border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer"
                  >
                    <Checkbox
                      checked={formData.workDays.includes(day.value)}
                      onCheckedChange={(checked) =>
                        handleWorkDayChange(day.value, !!checked)
                      }
                    />
                    <span className="text-sm font-medium text-gray-700">
                      {day.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Horário Padrão */}
            <div>
              <Label className="block text-sm font-medium text-gray-700 mb-3">
                Horário Padrão
              </Label>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="block text-xs text-gray-600 mb-1">
                    Início
                  </Label>
                  <Input
                    type="time"
                    placeholder="08:00"
                    value={formData.defaultStartTime}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        defaultStartTime: e.target.value,
                      }))
                    }
                  />
                </div>
                <div>
                  <Label className="block text-xs text-gray-600 mb-1">
                    Fim
                  </Label>
                  <Input
                    type="time"
                    placeholder="18:00"
                    value={formData.defaultEndTime}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        defaultEndTime: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>
            </div>

            {/* Horários Personalizados */}
            {formData.workDays.length > 0 && (
              <div>
                <Label className="block text-sm font-medium text-gray-700 mb-3">
                  Horários Personalizados por Dia
                </Label>
                <p className="text-xs text-gray-600 mb-4">
                  Se não definido, será usado o horário padrão.
                </p>
                <div className="space-y-3">
                  {formData.workDays.map((day) => {
                    const info = WEEKDAYS.find((w) => w.value === day);
                    const custom = formData.customSchedule?.[day];
                    return (
                      <div
                        key={day}
                        className="flex items-center space-x-4 p-3 border border-gray-200 rounded-lg"
                      >
                        <div className="w-12 text-sm font-medium text-gray-700">
                          {info?.label}
                        </div>
                        <div className="flex-1 grid grid-cols-2 gap-3">
                          <div>
                            <Label className="block text-xs text-gray-600 mb-1">
                              Início
                            </Label>
                            <Input
                              type="time"
                              placeholder={formData.defaultStartTime}
                              value={custom?.startTime || ""}
                              onChange={(e) =>
                                handleCustomScheduleChange(
                                  day,
                                  "startTime",
                                  e.target.value
                                )
                              }
                              className="text-sm"
                            />
                          </div>
                          <div>
                            <Label className="block text-xs text-gray-600 mb-1">
                              Fim
                            </Label>
                            <Input
                              type="time"
                              placeholder={formData.defaultEndTime}
                              value={custom?.endTime || ""}
                              onChange={(e) =>
                                handleCustomScheduleChange(
                                  day,
                                  "endTime",
                                  e.target.value
                                )
                              }
                              className="text-sm"
                            />
                          </div>
                        </div>
                        {(custom?.startTime || custom?.endTime) && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setFormData((prev) => {
                                const cs = { ...prev.customSchedule };
                                delete cs[day];
                                return { ...prev, customSchedule: cs };
                              });
                            }}
                            className="text-red-500 hover:text-red-700"
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

            {/* Revezamento de Fim de Semana */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <label className="flex items-center space-x-3">
                <Checkbox
                  checked={formData.weekendRotation}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({
                      ...prev,
                      weekendRotation: !!checked,
                    }))
                  }
                />
                <div>
                  <span className="text-sm font-medium text-gray-900">
                    Participar do revezamento de fim de semana
                  </span>
                  <p className="text-xs text-gray-600 mt-1">
                    Alterna entre sábado e domingo em semanas pares/ímpares
                  </p>
                </div>
              </label>
            </div>

            {/* Botões */}
            <div className="flex justify-end space-x-3 pt-6 border-t">
              <Button
                type="button"
                variant="ghost"
                onClick={onClose}
                disabled={isLoading}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isLoading}
                className="bg-brand hover:bg-brand-dark text-white"
              >
                <Save className="mr-2" size={16} />
                {isLoading ? "Salvando..." : "Salvar Funcionário"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
