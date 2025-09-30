'use client';
import React, { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Calendar } from './ui/calendar';
import { Search, Filter, Calendar as CalendarIcon, X, Tag } from 'lucide-react';
import { format } from 'date-fns';

interface SearchFiltersProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedTags: string[];
  setSelectedTags: (tags: string[]) => void;
  sortBy: string;
  setSortBy: (sort: string) => void;
  dateFrom?: Date;
  setDateFrom: (date?: Date) => void;
  dateTo?: Date;
  setDateTo: (date?: Date) => void;
  availableTags?: string[];
  onClearFilters?: () => void;
}

export default function SearchFilters({
  searchQuery,
  setSearchQuery,
  selectedTags,
  setSelectedTags,
  sortBy,
  setSortBy,
  dateFrom,
  setDateFrom,
  dateTo,
  setDateTo,
  availableTags = [],
  onClearFilters
}: SearchFiltersProps) {
  const [showDatePicker, setShowDatePicker] = useState<'from' | 'to' | null>(null);

  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter(t => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const removeTag = (tag: string) => {
    setSelectedTags(selectedTags.filter(t => t !== tag));
  };

  const clearAllFilters = () => {
    setSearchQuery('');
    setSelectedTags([]);
    setSortBy('newest');
    setDateFrom(undefined);
    setDateTo(undefined);
    onClearFilters?.();
  };

  const hasActiveFilters = searchQuery || selectedTags.length > 0 || sortBy !== 'newest' || dateFrom || dateTo;

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <Input
          placeholder="Search memories by caption or description..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 pr-4 h-11"
          aria-label="Search memories"
        />
      </div>

      {/* Filter Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        {/* Sort Dropdown */}
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-full sm:w-40 h-11">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest First</SelectItem>
            <SelectItem value="oldest">Oldest First</SelectItem>
            <SelectItem value="name">Name A-Z</SelectItem>
          </SelectContent>
        </Select>

        {/* Date Range Pickers */}
        <div className="flex gap-2 w-full sm:w-auto">
          <Popover open={showDatePicker === 'from'} onOpenChange={(open) => setShowDatePicker(open ? 'from' : null)}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="flex-1 sm:w-32 h-11 justify-start text-left font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" aria-hidden="true" />
                <span className="truncate">{dateFrom ? format(dateFrom, 'MMM dd') : 'From'}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dateFrom}
                onSelect={(date) => {
                  setDateFrom(date);
                  setShowDatePicker(null);
                }}
                initialFocus
              />
            </PopoverContent>
          </Popover>

          <Popover open={showDatePicker === 'to'} onOpenChange={(open) => setShowDatePicker(open ? 'to' : null)}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="flex-1 sm:w-32 h-11 justify-start text-left font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" aria-hidden="true" />
                <span className="truncate">{dateTo ? format(dateTo, 'MMM dd') : 'To'}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dateTo}
                onSelect={(date) => {
                  setDateTo(date);
                  setShowDatePicker(null);
                }}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Tag Filter Dropdown */}
        {availableTags.length > 0 && (
          <Select onValueChange={toggleTag}>
            <SelectTrigger className="w-full sm:w-32 h-11">
              <SelectValue placeholder="Add tag" />
            </SelectTrigger>
            <SelectContent>
              {availableTags
                .filter(tag => !selectedTags.includes(tag))
                .map((tag) => (
                  <SelectItem key={tag} value={tag}>
                    <Tag className="mr-2 h-4 w-4" aria-hidden="true" />
                    {tag}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        )}

        {/* Clear Filters */}
        {hasActiveFilters && (
          <Button variant="outline" onClick={clearAllFilters} className="w-full sm:w-auto h-11">
            <X className="mr-2 h-4 w-4" aria-hidden="true" />
            Clear Filters
          </Button>
        )}
      </div>

      {/* Active Filters Display */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">Active filters:</span>

          {/* Search Query */}
          {searchQuery && (
            <Badge variant="secondary" className="flex items-center gap-1">
              <Search className="h-3 w-3" />
              "{searchQuery}"
              <button
                onClick={() => setSearchQuery('')}
                className="ml-1 hover:bg-destructive/20 rounded-full p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}

          {/* Selected Tags */}
          {selectedTags.map((tag) => (
            <Badge key={tag} variant="secondary" className="flex items-center gap-1">
              <Tag className="h-3 w-3" />
              {tag}
              <button
                onClick={() => removeTag(tag)}
                className="ml-1 hover:bg-destructive/20 rounded-full p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}

          {/* Date Range */}
          {(dateFrom || dateTo) && (
            <Badge variant="secondary" className="flex items-center gap-1">
              <CalendarIcon className="h-3 w-3" />
              {dateFrom && format(dateFrom, 'MMM dd')}
              {dateFrom && dateTo && ' - '}
              {dateTo && format(dateTo, 'MMM dd')}
              <button
                onClick={() => {
                  setDateFrom(undefined);
                  setDateTo(undefined);
                }}
                className="ml-1 hover:bg-destructive/20 rounded-full p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}

          {/* Sort */}
          {sortBy !== 'newest' && (
            <Badge variant="secondary" className="flex items-center gap-1">
              Sort: {sortBy}
              <button
                onClick={() => setSortBy('newest')}
                className="ml-1 hover:bg-destructive/20 rounded-full p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
