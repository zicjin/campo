require 'nokogiri'

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

  def parse_img_from_html(content)
   doc = Nokogiri::HTML(content)
   images = doc.css("img").map{|links| links['src']}
  end
end
