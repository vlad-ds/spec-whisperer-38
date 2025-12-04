import { useState, useRef } from 'react';
import { X, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface PartyInputProps {
  parties: string[];
  onChange: (parties: string[]) => void;
}

export const PartyInput = ({ parties, onChange }: PartyInputProps) => {
  const [isAdding, setIsAdding] = useState(false);
  const [newParty, setNewParty] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleAdd = () => {
    if (newParty.trim()) {
      onChange([...parties, newParty.trim()]);
      setNewParty('');
      setIsAdding(false);
    }
  };

  const handleRemove = (index: number) => {
    onChange(parties.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    } else if (e.key === 'Escape') {
      setIsAdding(false);
      setNewParty('');
    }
  };

  const startAdding = () => {
    setIsAdding(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {parties.map((party, index) => (
          <div
            key={index}
            className="flex items-center gap-2 rounded-md bg-muted px-3 py-1.5 text-sm"
          >
            <span>{party}</span>
            <button
              onClick={() => handleRemove(index)}
              className="rounded-full p-0.5 hover:bg-foreground/10 transition-colors"
            >
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </div>
        ))}
      </div>
      
      {isAdding ? (
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={newParty}
            onChange={(e) => setNewParty(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter party name"
            className="flex-1"
          />
          <Button size="sm" onClick={handleAdd}>
            Add
          </Button>
          <Button 
            size="sm" 
            variant="ghost" 
            onClick={() => {
              setIsAdding(false);
              setNewParty('');
            }}
          >
            Cancel
          </Button>
        </div>
      ) : (
        <Button 
          variant="outline" 
          size="sm" 
          onClick={startAdding}
          className="gap-1"
        >
          <Plus className="h-4 w-4" />
          Add Party
        </Button>
      )}
    </div>
  );
};
