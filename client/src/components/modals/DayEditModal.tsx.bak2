import { useState, useEffect } from "react";
import { X, Plus, Edit, Trash2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useEmployees, useUpdateDaySchedule } from "@/hooks/useSchedule";
import type { Assignment, InsertAssignment } from "@shared/schema";
import { normalizeTime } from "@shared/schema";

interface DayEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  date: string;
  assignments: Assignment[];
}

export default function DayEditModal({ isOpen, onClose, date, assignments }: DayEditModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: employees = [] } = useEmployees();
  const updateDaySchedule = useUpdateDaySchedule();
  
  const [currentAssignments, setCurrentAssignments] = useState<Assignment[]>(assignments);
  const [newAssignment, setNewAssignment] = useState({
    employeeId: "",
    startTime: "",
    endTime: ""
  });

  useEffect(() => {
    setCurrentAssignments(assignments);
  }, [assignments]);

  if (!isOpen) return null;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('pt-BR', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const handleAddAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newAssignment.employeeId || !newAssignment.startTime || !newAssignment.endTime) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha todos os campos",
        variant: "destructive",
      });
      return;
    }

    const employee = employees.find(emp => emp.id === newAssignment.employeeId);
    if (!employee) {
      toast({
        title: "Funcionário não encontrado",
        variant: "destructive",
      });
      return;
    }

    const assignment: Assignment = {
      id: Date.now().toString(),
      employeeId: newAssignment.employeeId,
      employeeName: employee.name,
      startTime: normalizeTime(newAssignment.startTime),
      endTime: normalizeTime(newAssignment.endTime)
    };

    const updatedAssignments = [...currentAssignments, assignment];
    setCurrentAssignments(updatedAssignments);
    
    try {
      await updateDaySchedule.mutateAsync({
        date,
        assignments: updatedAssignments
      });
      
      toast({
        title: "Escala atualizada",
        description: "Escala foi atualizada com sucesso",
      });
      
      setNewAssignment({ employeeId: "", startTime: "", endTime: "" });
    } catch (error) {
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível atualizar a escala",
        variant: "destructive",
      });
      setCurrentAssignments(assignments);
    }
  };

  const handleRemoveAssignment = async (assignmentId: string) => {
    const updatedAssignments = currentAssignments.filter(a => a.id !== assignmentId);
    setCurrentAssignments(updatedAssignments);
    
    try {
      await updateDaySchedule.mutateAsync({
        date,
        assignments: updatedAssignments
      });
      
      toast({
        title: "Escala atualizada",
        description: "Escala foi atualizada com sucesso",
      });
    } catch (error) {
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível atualizar a escala",
        variant: "destructive",
      });
      setCurrentAssignments(assignments);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
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
              Editar Escala - <span className="text-brand">{formatDate(date)}</span>
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
          
          {/* Current Assignments */}
          <div className="mb-6">
            <h4 className="text-lg font-semibold text-gray-900 mb-4">Escalas Atuais</h4>
            <div className="space-y-3">
              {currentAssignments.length === 0 ? (
                <p className="text-gray-500 text-center py-4">Nenhuma escala para este dia</p>
              ) : (
                currentAssignments.map((assignment) => (
                  <div key={assignment.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                        <User className="text-blue-600" size={16} />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{assignment.employeeName}</p>
                        <p className="text-sm text-gray-600">{assignment.startTime} - {assignment.endTime}</p>
                      </div>
                    </div>
                    {user && (
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveAssignment(assignment.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 size={16} />
                        </Button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
          
          {/* Add New Assignment (Admin Only) */}
          {user && (
            <div className="border-t pt-6">
              <h4 className="text-lg font-semibold text-gray-900 mb-4">Adicionar Escala</h4>
              <form onSubmit={handleAddAssignment} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label className="block text-sm font-medium text-gray-700 mb-2">
                      Funcionário
                    </Label>
                    <Select
                      value={newAssignment.employeeId}
                      onValueChange={(value) => setNewAssignment(prev => ({ ...prev, employeeId: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecionar..." />
                      </SelectTrigger>
                      <SelectContent>
                        {employees.filter(emp => emp.isActive).map((employee) => (
                          <SelectItem key={employee.id} value={employee.id}>
                            {employee.name}
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
                      type="text"
                      placeholder="08:00"
                      value={newAssignment.startTime}
                      onChange={(e) => setNewAssignment(prev => ({ ...prev, startTime: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label className="block text-sm font-medium text-gray-700 mb-2">
                      Fim
                    </Label>
                    <Input
                      type="text"
                      placeholder="18:00"
                      value={newAssignment.endTime}
                      onChange={(e) => setNewAssignment(prev => ({ ...prev, endTime: e.target.value }))}
                    />
                  </div>
                </div>
                
                <div className="flex justify-end space-x-3 pt-4">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={onClose}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={updateDaySchedule.isPending}
                    className="bg-brand hover:bg-brand-dark text-white"
                  >
                    <Plus className="mr-2" size={16} />
                    {updateDaySchedule.isPending ? "Salvando..." : "Adicionar"}
                  </Button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
