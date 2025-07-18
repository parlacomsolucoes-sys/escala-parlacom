import { useState } from "react";
import { Plus, Edit, Trash2, User, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useEmployees, useDeleteEmployee } from "@/hooks/useSchedule";
import { useToast } from "@/hooks/use-toast";
import EmployeeModal from "@/components/modals/EmployeeModal";
import type { Employee } from "@shared/schema";

export default function EmployeesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: employees = [], isLoading } = useEmployees();
  const deleteEmployee = useDeleteEmployee();
  
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | undefined>();

  const handleCreateEmployee = () => {
    setSelectedEmployee(undefined);
    setShowEmployeeModal(true);
  };

  const handleEditEmployee = (employee: Employee) => {
    setSelectedEmployee(employee);
    setShowEmployeeModal(true);
  };

  const handleDeleteEmployee = async (employee: Employee) => {
    if (!confirm(`Tem certeza que deseja excluir ${employee.name}?`)) return;
    
    try {
      await deleteEmployee.mutateAsync(employee.id);
      toast({
        title: "Funcionário excluído",
        description: "Funcionário foi excluído com sucesso",
      });
    } catch (error) {
      toast({
        title: "Erro ao excluir",
        description: "Não foi possível excluir o funcionário",
        variant: "destructive",
      });
    }
  };

  const getWorkDaysDisplay = (workDays: string[]) => {
    const dayMap: Record<string, string> = {
      sunday: "Dom",
      monday: "Seg",
      tuesday: "Ter",
      wednesday: "Qua",
      thursday: "Qui",
      friday: "Sex",
      saturday: "Sáb",
    };
    
    return workDays.map(day => dayMap[day] || day);
  };

  const getEmployeeColor = (index: number) => {
    const colors = [
      "bg-brand/10 text-brand",
      "bg-purple-100 text-purple-600",
      "bg-green-100 text-green-600",
      "bg-blue-100 text-blue-600",
      "bg-orange-100 text-orange-600",
    ];
    return colors[index % colors.length];
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/3"></div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-8">
          <div className="animate-pulse space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center space-x-4">
                <div className="h-10 w-10 bg-gray-200 rounded-full"></div>
                <div className="space-y-2 flex-1">
                  <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Funcionários</h2>
            <p className="text-gray-600 mt-1">Gerencie funcionários e seus horários de trabalho</p>
          </div>
          
          {/* Add Employee Button (Admin Only) */}
          {user && (
            <Button
              onClick={handleCreateEmployee}
              className="bg-brand hover:bg-brand-dark text-white"
            >
              <Plus className="mr-2" size={16} />
              Novo Funcionário
            </Button>
          )}
        </div>
        
        {/* Employees Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Nome
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Dias de Trabalho
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Horário Padrão
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  {user && (
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Ações
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {employees.length === 0 ? (
                  <tr>
                    <td colSpan={user ? 5 : 4} className="px-6 py-8 text-center">
                      <div className="flex flex-col items-center">
                        <User className="h-12 w-12 text-gray-400 mb-4" />
                        <p className="text-gray-500">Nenhum funcionário cadastrado</p>
                        {user && (
                          <Button
                            onClick={handleCreateEmployee}
                            className="mt-4 bg-brand hover:bg-brand-dark text-white"
                          >
                            <Plus className="mr-2" size={16} />
                            Adicionar Funcionário
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  employees.map((employee, index) => (
                    <tr key={employee.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className={`h-10 w-10 rounded-full flex items-center justify-center ${getEmployeeColor(index)}`}>
                            <User size={20} />
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">{employee.name}</div>
                            <div className="text-sm text-gray-500">ID: #{employee.id.slice(-6)}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-wrap gap-1">
                          {getWorkDaysDisplay(employee.workDays).map((day) => (
                            <Badge key={day} variant="secondary" className="text-xs">
                              {day}
                            </Badge>
                          ))}
                          {employee.weekendRotation && (
                            <Badge variant="outline" className="text-xs border-yellow-300 text-yellow-700 bg-yellow-50">
                              <RotateCcw size={12} className="mr-1" />
                              Revezamento
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {employee.defaultStartTime} - {employee.defaultEndTime}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge 
                          variant={employee.isActive ? "default" : "secondary"}
                          className={employee.isActive ? "bg-green-100 text-green-800" : ""}
                        >
                          <div className={`w-2 h-2 rounded-full mr-1.5 ${employee.isActive ? "bg-green-400" : "bg-gray-400"}`}></div>
                          {employee.isActive ? "Ativo" : "Inativo"}
                        </Badge>
                      </td>
                      {user && (
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex justify-end space-x-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditEmployee(employee)}
                              className="text-brand hover:text-brand-dark"
                            >
                              <Edit size={16} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteEmployee(employee)}
                              className="text-red-600 hover:text-red-700"
                              disabled={deleteEmployee.isPending}
                            >
                              <Trash2 size={16} />
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Employee Modal */}
      {showEmployeeModal && (
        <EmployeeModal
          isOpen={showEmployeeModal}
          onClose={() => setShowEmployeeModal(false)}
          employee={selectedEmployee}
        />
      )}
    </>
  );
}
