import { useState } from "react";
import { Plus, Edit, Trash2, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useHolidays, useDeleteHoliday } from "@/hooks/useSchedule";
import { useToast } from "@/hooks/use-toast";
import HolidayModal from "@/components/modals/HolidayModal";
import type { Holiday } from "@shared/schema";

export default function HolidaysPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: holidays = [], isLoading } = useHolidays();
  const deleteHoliday = useDeleteHoliday();
  
  const [showHolidayModal, setShowHolidayModal] = useState(false);
  const [selectedHoliday, setSelectedHoliday] = useState<Holiday | undefined>();

  const handleCreateHoliday = () => {
    setSelectedHoliday(undefined);
    setShowHolidayModal(true);
  };

  const handleEditHoliday = (holiday: Holiday) => {
    setSelectedHoliday(holiday);
    setShowHolidayModal(true);
  };

  const handleDeleteHoliday = async (holiday: Holiday) => {
    if (!confirm(`Tem certeza que deseja excluir ${holiday.name}?`)) return;
    
    try {
      await deleteHoliday.mutateAsync(holiday.id);
      toast({
        title: "Feriado excluído",
        description: "Feriado foi excluído com sucesso",
      });
    } catch (error) {
      toast({
        title: "Erro ao excluir",
        description: "Não foi possível excluir o feriado",
        variant: "destructive",
      });
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('pt-BR', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  // Sort holidays by date
  const sortedHolidays = [...holidays].sort((a, b) => a.date.localeCompare(b.date));

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/3"></div>
        </div>
        <div className="grid gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="animate-pulse flex items-center space-x-4">
                <div className="h-12 w-12 bg-gray-200 rounded-xl"></div>
                <div className="space-y-2 flex-1">
                  <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/4"></div>
                </div>
              </div>
            </div>
          ))}
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
            <h2 className="text-2xl font-bold text-gray-900">Feriados</h2>
            <p className="text-gray-600 mt-1">Gerencie feriados e datas especiais</p>
          </div>
          
          {/* Add Holiday Button (Admin Only) */}
          {user && (
            <Button
              onClick={handleCreateHoliday}
              className="bg-brand hover:bg-brand-dark text-white"
            >
              <Plus className="mr-2" size={16} />
              Novo Feriado
            </Button>
          )}
        </div>
        
        {/* Holidays List */}
        <div className="grid gap-4">
          {sortedHolidays.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
              <div className="flex flex-col items-center">
                <Star className="h-12 w-12 text-gray-400 mb-4" />
                <p className="text-gray-500 mb-4">Nenhum feriado cadastrado</p>
                {user && (
                  <Button
                    onClick={handleCreateHoliday}
                    className="bg-brand hover:bg-brand-dark text-white"
                  >
                    <Plus className="mr-2" size={16} />
                    Adicionar Feriado
                  </Button>
                )}
              </div>
            </div>
          ) : (
            sortedHolidays.map((holiday) => (
              <div
                key={holiday.id}
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="h-12 w-12 rounded-xl bg-brand/10 flex items-center justify-center">
                      <Star className="text-brand" size={24} />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{holiday.name}</h3>
                      <p className="text-sm text-gray-600">{formatDate(holiday.date)}</p>
                      {holiday.description && (
                        <p className="text-sm text-gray-500 mt-1">{holiday.description}</p>
                      )}
                    </div>
                  </div>
                  
                  {/* Actions (Admin Only) */}
                  {user && (
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditHoliday(holiday)}
                        className="text-gray-400 hover:text-brand rounded-lg hover:bg-gray-50"
                      >
                        <Edit size={16} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteHoliday(holiday)}
                        className="text-gray-400 hover:text-red-600 rounded-lg hover:bg-gray-50"
                        disabled={deleteHoliday.isPending}
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Holiday Modal */}
      {showHolidayModal && (
        <HolidayModal
          isOpen={showHolidayModal}
          onClose={() => setShowHolidayModal(false)}
          holiday={selectedHoliday}
        />
      )}
    </>
  );
}
