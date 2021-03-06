module TopicsHelper
  def topic_last_path(topic)
    topic_path(topic, page: (topic.total_pages if topic.total_pages > 1), anchor: (topic.comments_count if topic.comments_count > 0))
  end
  def nba_topic_last_path(topic)
    nba_topic_path(topic, page: (topic.total_pages if topic.total_pages > 1), anchor: (topic.comments_count if topic.comments_count > 0))
  end
  def tennis_topic_last_path(topic)
    tennis_topic_path(topic, page: (topic.total_pages if topic.total_pages > 1), anchor: (topic.comments_count if topic.comments_count > 0))
  end

  def apps_topic_last_path(topic)
    apps_topic_path(topic, page: (topic.total_pages if topic.total_pages > 1), anchor: (topic.comments_count if topic.comments_count > 0))
  end
  def apps_nba_topic_last_path(topic)
    apps_nba_topic_path(topic, page: (topic.total_pages if topic.total_pages > 1), anchor: (topic.comments_count if topic.comments_count > 0))
  end
end
