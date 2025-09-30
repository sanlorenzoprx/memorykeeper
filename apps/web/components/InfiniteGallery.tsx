'use client';
import React, { useEffect, useCallback } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import PhotoCard from './PhotoCard';
import { Photo } from '@memorykeeper/types';
import { useAuth } from '@clerk/nextjs';
import { createIntersectionObserver, debounce } from '@/lib/performance';

export default function InfiniteGallery() {
    const { getToken } = useAuth();
    const {
        data,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        isLoading,
        error
    } = useInfiniteQuery({
        queryKey: ['photos'],
        queryFn: async ({ pageParam = 0 }) => {
            const token = await getToken();
            return apiGet(`/api/photos?cursor=${pageParam}`, token);
        },
        getNextPageParam: (lastPage) => lastPage.nextCursor,
        initialPageParam: 0,
    });

    // Intersection Observer for infinite scroll
    const handleIntersection = useCallback((entries: IntersectionObserverEntry[]) => {
        const target = entries[0];
        if (target.isIntersecting && hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
        }
    }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

    useEffect(() => {
        const observer = createIntersectionObserver(handleIntersection, {
            rootMargin: '100px',
        });

        if (observer) {
            const sentinel = document.getElementById('infinite-scroll-sentinel');
            if (sentinel) {
                observer.observe(sentinel);
            }

            return () => observer.disconnect();
        }
    }, [handleIntersection]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                <span className="ml-2 text-muted-foreground">Loading your memories...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-center py-16">
                <h2 className="text-2xl font-bold text-destructive mb-2">Error Loading Photos</h2>
                <p className="text-muted-foreground">
                    {error instanceof Error ? error.message : 'An error occurred while loading your photos.'}
                </p>
            </div>
        );
    }

    const allPhotos = data?.pages.flatMap(page => page.photos) || [];

    return (
        <div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {allPhotos.map((photo: Photo) => (
                    <PhotoCard key={photo.id} photo={photo} />
                ))}
            </div>

            {/* Infinite scroll sentinel */}
            {hasNextPage && (
                <div
                    id="infinite-scroll-sentinel"
                    className="h-10 flex items-center justify-center mt-8"
                >
                    {isFetchingNextPage ? (
                        <div className="flex items-center gap-2">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                            <span className="text-sm text-muted-foreground">Loading more...</span>
                        </div>
                    ) : (
                        <div className="h-2" />
                    )}
                </div>
            )}
        </div>
    );
}