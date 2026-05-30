import { getTopicConfig, type TopicConfig, type TopicId } from '@/lib/topics';
import { useTrackerStore } from '@/store/trackerStore';

export function useCurrentTopicId(): TopicId {
  const user = useTrackerStore((s) => s.currentUser);
  return useTrackerStore((s) => {
    if (!user) return 'sport';
    return s.userTopics[user] ?? 'sport';
  });
}

export function useAppTopic(): TopicConfig {
  const topicId = useCurrentTopicId();
  return getTopicConfig(topicId);
}
