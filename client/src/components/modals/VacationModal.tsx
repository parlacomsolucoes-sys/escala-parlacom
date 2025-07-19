import { useState, useEffect } from "react";
import { X } from "lucide-react";
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
import { useEmployees } from "@/hooks/useSchedule";
import { useCreateVacation, useUpdateVacation } from "@/hooks/useVacations";
import { useToast } from "@/hooks/use-toast";
import type { Vacation, InsertVacation } from "@shared/schema";

interface VacationModalProps {
  isOpen: boolean;
  onClose: () => void;
  vacation?: Vacation | null;
  onSuccess: () => void;
}

export default function VacationModal({
  isOpen,
  onClose,
  vacation,
  onSuccess,
}: VacationModalProps) {
  const { toast } = useToast();
  const { data: employees = [] } = useEmployees();
  const createVacation = useCreateVacation();
  const updateVacation = useUpdateVacation();

  const [formData, setFormData] = useState<InsertVacation>({
    employeeId: "",
    startDate: "",
    endDate: "",
    notes: "",
  });

  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    if (vacation) {
      setFormData({
        employeeId: vacation.employeeId,
        startDate: vacation.startDate,
        endDate: vacation.endDate,
        notes: vacation.notes || "",
      });
    } else {
      setFormData({
        employeeId: "",
        startDate: "",
        endDate: "",
        notes: "",
      });
    }
    setErrors({});
  }, [vacation, isOpen]);

  const validate = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    if (!formData.employeeId) {
      newErrors.employeeId = "Funcionário é obrigatório";
    }

    if (!formData.startDate) {
      newErrors.startDate = "Data de início é obrigatória";
    }

    if (!formData.endDate) {
      newErrors.endDate = "Data de fim é obrigatória";
    }

    if (formData.startDate && formData.endDate) {
      const startDate = new Date(formData.startDate);
      const endDate = new Date(formData.endDate);

      if (startDate > endDate) {
        newErrors.endDate = "Data de fim deve ser posterior à data de início";
      }

      if (startDate.getFullYear() !== endDate.getFullYear()) {
        newErrors.endDate = "Período não pode atravessar anos";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    try {
      if (vacation) {
        await updateVacation.mutateAsync({
          id: vacation.id,
          ...formData,
        });
        toast({
          title: "Sucesso",
          description: "Período de férias atualizado com sucesso",
        });
      } else {
        await createVacation.mutateAsync(formData);
        toast({
          title: "Sucesso",
          description: "Período de férias criado com sucesso",
        });
      }

      onSuccess();
      onClose();
    } catch (error: any) {
      console.error("Vacation operation error:", error);
      
      let errorMessage = "Ocorreu um erro inesperado";
      
      if (error.message.includes("conflita")) {
        errorMessage = "Este período conflita com outro período existente para este funcionário";
      } else if (error.message.includes("atravessar")) {
        errorMessage = "O período não pode atravessar anos";
      } else if (error.message.includes("não encontrado")) {
        errorMessage = "Funcionário não encontrado";
      }

      toast({
        variant: "destructive",
        title: "Erro",
        description: errorMessage,
      });
    }
  };

  const handleInputChange = (field: keyof InsertVacation, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: "" }));
    }
  };

  const activeEmployees = employees.filter(emp => emp.isActive);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {vacation ? "Editar Férias" : "Nova Férias"}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <Label htmlFor="employee">Funcionário</Label>
            <Select
              value={formData.employeeId}
              onValueChange={(value) => handleInputChange("employeeId", value)}
            >
              <SelectTrigger className={errors.employeeId ? "border-red-500" : ""}>
                <SelectValue placeholder="Selecione um funcionário" />
              </SelectTrigger>
              <SelectContent>
                {activeEmployees
                  .filter(employee => employee.id && employee.id.trim() !== "")
                  .map((employee) => (
                    <SelectItem key={employee.id} value={employee.id}>
                      {employee.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            {errors.employeeId && (
              <p className="text-sm text-red-500 mt-1">{errors.employeeId}</p>
            )}
          </div>

          <div>
            <Label htmlFor="startDate">Data de Início</Label>
            <Input
              id="startDate"
              type="date"
              value={formData.startDate}
              onChange={(e) => handleInputChange("startDate", e.target.value)}
              className={errors.startDate ? "border-red-500" : ""}
            />
            {errors.startDate && (
              <p className="text-sm text-red-500 mt-1">{errors.startDate}</p>
            )}
          </div>

          <div>
            <Label htmlFor="endDate">Data de Fim</Label>
            <Input
              id="endDate"
              type="date"
              value={formData.endDate}
              onChange={(e) => handleInputChange("endDate", e.target.value)}
              className={errors.endDate ? "border-red-500" : ""}
            />
            {errors.endDate && (
              <p className="text-sm text-red-500 mt-1">{errors.endDate}</p>
            )}
          </div>

          <div>
            <Label htmlFor="notes">Observações (opcional)</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => handleInputChange("notes", e.target.value)}
              placeholder="Adicione observações sobre este período de férias..."
              rows={3}
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={createVacation.isPending || updateVacation.isPending}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={createVacation.isPending || updateVacation.isPending}
            >
              {createVacation.isPending || updateVacation.isPending
                ? "Salvando..."
                : vacation
                ? "Atualizar"
                : "Criar"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}