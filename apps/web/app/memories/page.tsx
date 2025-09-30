'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import { useAuth } from '@clerk/nextjs';
import PhotoCard from '@/components/PhotoCard';
import SearchFilters from '@/components/SearchFilters';
import { Button } from '@/components/ui/button';
import { Plus, Grid, List } from 'lucide-react';
import { useI18n } from '@/contexts/I18nProvider';

export default function MemoriesPage() {
  const { getToken } = useAuth();
  const { t } = useI18n();

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState('newest');
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [availableTags, setAvailableTags] = useState<string[]>([]);

  // Build query parameters
  const queryParams = new URLSearchParams();
  if (searchQuery) queryParams.append('search', searchQuery);
  if (selectedTags.length > 0) {
    selectedTags.forEach(tag => queryParams.append('tags', tag));
  }
  if (sortBy !== 'newest') queryParams.append('sort', sortBy);
  if (dateFrom) queryParams.append('dateFrom', dateFrom.toISOString());
  if (dateTo) queryParams.append('dateTo', dateTo.toISOString());

  const { data: photosData, isLoading, error, refetch } = useQuery({
    queryKey: ['photos', searchQuery, selectedTags, sortBy, dateFrom, dateTo],
    queryFn: async () => {
      const token = await getToken();
      const queryString = queryParams.toString();
      const url = `/api/photos${queryString ? `?${queryString}` : ''}`;

      const response = await apiGet(url, token);

      // Extract available tags from the response for the filter dropdown
      if (response.photos) {
        const allTags = response.photos
          .flatMap((photo: any) => photo.tags || [])
          .filter((tag: string, index: number, arr: string[]) => arr.indexOf(tag) === index);
        setAvailableTags(allTags);
      }

      return response;
    },
  });

  const photos = photosData?.photos || [];

  const handleClearFilters = () => {
    refetch();
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <span className="ml-2 text-muted-foreground">Loading your memories...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-destructive mb-2">Error Loading Photos</h2>
          <p className="text-muted-foreground">
            {error instanceof Error ? error.message : 'An error occurred while loading your photos.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 sm:mb-6 gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold mb-1 sm:mb-2">{t('memories.title')}</h1>
            <p className="text-muted-foreground text-sm sm:text-base">
              {photos.length === 0
                ? t('memories.subtitle')
                : t('memories.subtitleWithCount', { count: photos.length })
              }
            </p>
          </div>

          <Button asChild className="w-full sm:w-auto">
            <a href="/upload">
              <Plus className="mr-2 h-4 w-4" />
              {t('memories.addMemory')}
            </a>
          </Button>
        </div>

        {/* Search and Filters */}
        <div className="bg-card/50 backdrop-blur-sm rounded-lg p-4 sm:p-6 border">
          <SearchFilters
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            selectedTags={selectedTags}
            setSelectedTags={setSelectedTags}
            sortBy={sortBy}
            setSortBy={setSortBy}
            dateFrom={dateFrom}
            setDateFrom={setDateFrom}
            dateTo={dateTo}
            setDateTo={setDateTo}
            availableTags={availableTags}
            onClearFilters={handleClearFilters}
          />
        </div>
      </div>

      {/* Photos Grid/List */}
      {photos.length === 0 ? (
        <div className="text-center py-16">
          <div className="max-w-md mx-auto">
            <div className="w-24 h-24 mx-auto mb-4 bg-muted rounded-full flex items-center justify-center">
              <Plus className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-semibold mb-2">
              {searchQuery || selectedTags.length > 0 || dateFrom || dateTo
                ? t('memories.noMemories')
                : "No memories yet"
              }
            </h3>
            <p className="text-muted-foreground mb-6">
              {searchQuery || selectedTags.length > 0 || dateFrom || dateTo
                ? t('memories.noMemoriesDescription')
                : t('memories.noMemoriesAlt')
              }
            </p>
            {searchQuery || selectedTags.length > 0 || dateFrom || dateTo ? (
              <Button variant="outline" onClick={handleClearFilters}>
                {t('memories.clearFilters')}
              </Button>
            ) : (
              <Button asChild>
                <a href="/upload">
                  <Plus className="mr-2 h-4 w-4" />
                  {t('memories.uploadFirst')}
                </a>
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className={
          viewMode === 'grid'
            ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
            : "space-y-4"
        }>
          {photos.map((photo: any) => (
            <PhotoCard
              key={photo.id}
              photo={photo}
              viewMode={viewMode}
            />
          ))}
        </div>
      )}
    </div>
  );
}