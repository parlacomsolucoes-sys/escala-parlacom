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
    observations: "", // <- NOVO
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
        observations: employee.observations || "",
      });
    }
  }, [employee, isOpen]);

  if (!isOpen) return null;

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
      toast({ title: "Erro ao salvar", variant: "destructive" });
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg w-full max-w-2xl p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold">
            {employee ? "Editar Funcionário" : "Novo Funcionário"}
          </h3>
          <Button variant="ghost" onClick={onClose}>
            <X />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Nome */}
          <div>
            <Label>Nome Completo</Label>
            <Input
              required
              value={formData.name}
              onChange={(e) =>
                setFormData((f) => ({ ...f, name: e.target.value }))
              }
            />
          </div>

          {/* Observações */}
          <div>
            <Label>Observações</Label>
            <Textarea
              placeholder="Ex.: Almoço 13h‑14h"
              value={formData.observations}
              onChange={(e) =>
                setFormData((f) => ({ ...f, observations: e.target.value }))
              }
            />
          </div>

          {/* … other fields (workDays, times, etc.) … */}

          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" className="bg-brand text-white">
              <Save className="mr-1" /> Salvar
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
