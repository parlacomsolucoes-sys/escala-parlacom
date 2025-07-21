// src/components/modals/DayEditModal.tsx

import { useState, useEffect } from "react";
import { X, Plus, Trash2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useEmployees, useUpdateDaySchedule } from "@/hooks/useSchedule";
import type { Assignment } from "@shared/schema";
import { normalizeTime } from "@shared/schema";

interface DayEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  date: string;
  assignments: Assignment[];
  onVacationEmployeeIds?: string[];
}

export default function DayEditModal({
  isOpen,
  onClose,
  date,
  assignments,
  onVacationEmployeeIds = [],
}: DayEditModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: employees = [] } = useEmployees();
  const updateDaySchedule = useUpdateDaySchedule();

  const [currentAssignments, setCurrentAssignments] =
    useState<Assignment[]>(assignments);
  const [newAssignment, setNewAssignment] = useState({
    employeeId: "",
    startTime: "",
    endTime: "",
  });
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setCurrentAssignments(assignments);
    setDirty(false);
  }, [assignments]);

  if (!isOpen) return null;

  const formatDate = (dateString: string) => {
    const d = new Date(dateString + "T00:00:00");
    return d.toLocaleDateString("pt-BR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  // only update local state
  const handleAddLocal = (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !newAssignment.employeeId ||
      !newAssignment.startTime ||
      !newAssignment.endTime
    ) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha todos os campos",
        variant: "destructive",
      });
      return;
    }
    const emp = employees.find((x) => x.id === newAssignment.employeeId);
    if (!emp) {
      toast({ title: "Funcionário não encontrado", variant: "destructive" });
      return;
    }
    const asg: Assignment = {
      id: `${emp.id}-${date}`,
      employeeId: emp.id,
      employeeName: emp.name,
      startTime: normalizeTime(newAssignment.startTime),
      endTime: normalizeTime(newAssignment.endTime),
    };
    setCurrentAssignments((prev) => [
      ...prev.filter((a) => a.employeeId !== asg.employeeId),
      asg,
    ]);
    setNewAssignment({ employeeId: "", startTime: "", endTime: "" });
    setDirty(true);
  };

  // only update local state
  const handleRemoveLocal = (employeeId: string) => {
    setCurrentAssignments((prev) =>
      prev.filter((a) => a.employeeId !== employeeId)
    );
    setDirty(true);
  };

  const handleSave = async () => {
    try {
      await updateDaySchedule.mutateAsync({
        date,
        assignments: currentAssignments,
      });
      toast({
        title: "Escala atualizada",
        description: "Todas as alterações foram salvas",
      });
      setDirty(false);
      onClose();
    } catch {
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível atualizar a escala",
        variant: "destructive",
      });
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-gray-900">
              Editar Escala –{" "}
              <span className="text-brand">{formatDate(date)}</span>
            </h3>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X size={20} />
            </Button>
          </div>

          {/* Current Assignments */}
          <div className="mb-6">
            <h4 className="text-lg font-semibold text-gray-900 mb-4">
              Escalas Atuais
            </h4>
            <div className="space-y-3">
              {currentAssignments.length === 0 ? (
                <p className="text-gray-500 text-center py-4">
                  Nenhuma escala para este dia
                </p>
              ) : (
                currentAssignments.map((a) => (
                  <div
                    key={a.employeeId}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                        <User className="text-blue-600" size={16} />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">
                          {a.employeeName}
                        </p>
                        <p className="text-sm text-gray-600">
                          {a.startTime} – {a.endTime}
                        </p>
                      </div>
                    </div>
                    {user && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveLocal(a.employeeId)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 size={16} />
                      </Button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Vacation Notices */}
          {onVacationEmployeeIds.length > 0 && (
            <div className="mb-6">
              <h4 className="text-lg font-semibold text-gray-900 mb-4">
                Funcionários em Férias
              </h4>
              <div className="space-y-2">
                {employees
                  .filter((emp) => onVacationEmployeeIds.includes(emp.id))
                  .map((emp) => (
                    <div
                      key={emp.id}
                      className="flex items-center p-3 bg-yellow-50 border border-yellow-200 rounded-lg"
                    >
                      <div className="h-6 w-6 rounded-full bg-yellow-100 flex items-center justify-center mr-3">
                        <User className="text-yellow-600" size={14} />
                      </div>
                      <span className="text-sm font-medium text-yellow-800">
                        {emp.name}
                      </span>
                      <span className="text-xs text-yellow-600 ml-2">
                        (em férias)
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Add Assignment */}
          {user && (
            <form onSubmit={handleAddLocal} className="border-t pt-6 space-y-4">
              <h4 className="text-lg font-semibold text-gray-900 mb-4">
                Adicionar ou Atualizar Horário
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label className="block text-sm font-medium text-gray-700 mb-2">
                    Funcionário
                  </Label>
                  <Select
                    value={newAssignment.employeeId}
                    onValueChange={(val) =>
                      setNewAssignment((p) => ({ ...p, employeeId: val }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar..." />
                    </SelectTrigger>
                    <SelectContent>
                      {employees
                        .filter(
                          (emp) =>
                            emp.isActive &&
                            !onVacationEmployeeIds.includes(emp.id)
                        )
                        .map((emp) => (
                          <SelectItem key={emp.id} value={emp.id}>
                            {emp.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="block text-sm font-medium text-gray-700 mb-2">
                    Início
                  </Label>
                  <Input
                    type="time"
                    value={newAssignment.startTime}
                    onChange={(e) =>
                      setNewAssignment((p) => ({
                        ...p,
                        startTime: e.target.value,
                      }))
                    }
                  />
                </div>
                <div>
                  <Label className="block text-sm font-medium text-gray-700 mb-2">
                    Fim
                  </Label>
                  <Input
                    type="time"
                    value={newAssignment.endTime}
                    onChange={(e) =>
                      setNewAssignment((p) => ({
                        ...p,
                        endTime: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setNewAssignment({
                      employeeId: "",
                      startTime: "",
                      endTime: "",
                    });
                  }}
                >
                  Limpar Campos
                </Button>
                <Button
                  type="submit"
                  className="bg-brand hover:bg-brand-dark text-white"
                >
                  <Plus className="mr-2" size={16} />
                  Adicionar / Atualizar
                </Button>
              </div>
            </form>
          )}

          {/* Save / Cancel */}
          <div className="border-t pt-6 flex justify-end space-x-3">
            <Button variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={!dirty || updateDaySchedule.isPending}
              className="bg-brand hover:bg-brand-dark text-white"
            >
              {updateDaySchedule.isPending
                ? "Salvando..."
                : "Salvar Alterações"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
