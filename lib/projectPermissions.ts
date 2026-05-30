import type { Project } from '@/lib/types';
import type { TopicId } from '@/lib/topics';

export function getSharedProjectsStorageKey(_topicId: TopicId): string | null {
  return null;
}

export function usesSharedProjects(_topicId: TopicId): boolean {
  return false;
}

export function canEditProject(
  _project: Project,
  _topicId: TopicId,
  _currentUser: string | null,
  _currentUid?: string | null
): boolean {
  return true;
}

export function projectCreatorLabel(project: Project): string | null {
  return project.createdBy ?? null;
}
