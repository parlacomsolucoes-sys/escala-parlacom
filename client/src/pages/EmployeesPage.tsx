import { useState } from "react";
import { Plus, Edit, Trash2, User, RotateCcw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useEmployees, useDeleteEmployee } from "@/hooks/useSchedule";
import { useToast } from "@/hooks/use-toast";
import EmployeeModal from "@/components/modals/EmployeeModal";
import type { Employee } from "@shared/schema";

export default function EmployeesPage() {
  /* -------------------------------------------------- */
  /* hooks / state                                      */
  /* -------------------------------------------------- */
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: employees = [], isLoading } = useEmployees();
  const deleteEmployee = useDeleteEmployee();

  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<
    Employee | undefined
  >();

  /* -------------------------------------------------- */
  /* handlers                                           */
  /* -------------------------------------------------- */
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
    } catch {
      toast({
        title: "Erro ao excluir",
        description: "Não foi possível excluir o funcionário",
        variant: "destructive",
      });
    }
  };

  /* -------------------------------------------------- */
  /* helpers                                            */
  /* -------------------------------------------------- */
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
    return workDays.map((d) => dayMap[d] || d);
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

  /* -------------------------------------------------- */
  /* loading skeleton                                   */
  /* -------------------------------------------------- */
  if (isLoading) {
    return (
      <div className="flex flex-col space-y-6">
        <div className="flex items-center space-x-2">
          <Loader2 className="animate-spin text-brand" />
          <span className="text-gray-600">Carregando funcionários…</span>
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

  /* -------------------------------------------------- */
  /* render                                             */
  /* -------------------------------------------------- */
  return (
    <>
      {/* page header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Funcionários</h2>
          <p className="text-gray-600 mt-1">
            Gerencie funcionários e seus horários de trabalho
          </p>
        </div>

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

      {/* table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nome
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Dias de&nbsp;Trabalho
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Horário&nbsp;Padrão
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Observações
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
                  <td colSpan={user ? 6 : 5} className="px-6 py-8 text-center">
                    <div className="flex flex-col items-center">
                      <User className="h-12 w-12 text-gray-400 mb-4" />
                      <p className="text-gray-500">
                        Nenhum funcionário cadastrado
                      </p>
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
                    {/* Nome + avatar */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div
                          className={`h-10 w-10 rounded-full flex items-center justify-center ${getEmployeeColor(
                            index
                          )}`}
                        >
                          <User size={20} />
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {employee.name}
                          </div>
                          <div className="text-xs text-gray-500">
                            ID&nbsp;#{employee.id.slice(-6)}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Dias */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-wrap gap-1">
                        {getWorkDaysDisplay(employee.workDays).map((day) => (
                          <Badge
                            key={day}
                            variant="secondary"
                            className="text-xs"
                          >
                            {day}
                          </Badge>
                        ))}

                        {employee.weekendRotation && (
                          <Badge
                            variant="outline"
                            className="text-xs border-yellow-300 text-yellow-700 bg-yellow-50"
                          >
                            <RotateCcw size={12} className="mr-1" />
                            Revezamento
                          </Badge>
                        )}

                        {employee.customSchedule &&
                          Object.keys(employee.customSchedule).length > 0 && (
                            <Badge
                              variant="outline"
                              className="text-xs border-blue-300 text-blue-700 bg-blue-50"
                            >
                              Horários Personalizados
                            </Badge>
                          )}
                      </div>
                    </td>

                    {/* Horário padrão */}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {employee.defaultStartTime} - {employee.defaultEndTime}
                    </td>

                    {/* Observações */}
                    <td className="px-6 py-4 whitespace-pre-wrap text-sm text-gray-700 max-w-xs">
                      {employee.observations?.trim() || (
                        <span className="italic text-gray-400">—</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge
                        variant={employee.isActive ? "default" : "secondary"}
                        className={
                          employee.isActive ? "bg-green-100 text-green-800" : ""
                        }
                      >
                        <div
                          className={`w-2 h-2 rounded-full mr-1.5 ${
                            employee.isActive ? "bg-green-400" : "bg-gray-400"
                          }`}
                        ></div>
                        {employee.isActive ? "Ativo" : "Inativo"}
                      </Badge>
                    </td>

                    {/* Ações (admin) */}
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

      {/* modal */}
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
