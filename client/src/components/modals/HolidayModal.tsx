import { useState, useEffect } from "react";
import { X, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useCreateHoliday } from "@/hooks/useSchedule";
import type { Holiday, InsertHoliday } from "@shared/schema";

interface HolidayModalProps {
  isOpen: boolean;
  onClose: () => void;
  holiday?: Holiday;
}

export default function HolidayModal({ isOpen, onClose, holiday }: HolidayModalProps) {
  const { toast } = useToast();
  const createHoliday = useCreateHoliday();
  
  const [formData, setFormData] = useState<InsertHoliday>({
    name: "",
    date: "",
    description: "",
  });

  useEffect(() => {
    if (holiday) {
      setFormData({
        name: holiday.name,
        date: holiday.date,
        description: holiday.description || "",
      });
    } else {
      setFormData({
        name: "",
        date: "",
        description: "",
      });
    }
  }, [holiday, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // PHASE 7: Extract MM-DD from date input before submitting
      let dateToSubmit = formData.date;
      if (dateToSubmit.match(/^\d{4}-\d{2}-\d{2}$/)) {
        dateToSubmit = dateToSubmit.substring(5); // Keep only MM-DD part
      }
      
      await createHoliday.mutateAsync({
        ...formData,
        date: dateToSubmit
      });
      toast({
        title: "Feriado criado",
        description: "Feriado foi criado com sucesso",
      });
      onClose();
    } catch (error) {
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar o feriado",
        variant: "destructive",
      });
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
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-gray-900">
              {holiday ? "Editar Feriado" : "Novo Feriado"}
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
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label className="block text-sm font-medium text-gray-700 mb-2">
                Nome do Feriado
              </Label>
              <Input
                type="text"
                required
                placeholder="Ex: Carnaval"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            
            <div>
              <Label className="block text-sm font-medium text-gray-700 mb-2">
                Data (Mês e Dia)
              </Label>
              <Input
                type="date"
                required
                value={formData.date.length === 5 ? `2024-${formData.date}` : formData.date}
                onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
              />
              <p className="text-xs text-gray-500 mt-1">
                Feriados são recorrentes todos os anos na mesma data
              </p>
            </div>
            
            <div>
              <Label className="block text-sm font-medium text-gray-700 mb-2">
                Descrição (opcional)
              </Label>
              <Textarea
                placeholder="Descrição do feriado..."
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
              />
            </div>
            
            <div className="flex justify-end space-x-3 pt-4">
              <Button
                type="button"
                variant="ghost"
                onClick={onClose}
                disabled={createHoliday.isPending}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={createHoliday.isPending}
                className="bg-brand hover:bg-brand-dark text-white"
              >
                <Save className="mr-2" size={16} />
                {createHoliday.isPending ? "Salvando..." : "Salvar Feriado"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
