class Comment < ActiveRecord::Base
  include Likeable
  include Trashable

  has_many :notifications, as: 'subject', dependent: :delete_all
  belongs_to :user
  belongs_to :commentable, polymorphic: true, counter_cache: true, touch: true

  validates :commentable_type, inclusion: { in: %w(Topic NbaTopic TennisTopic) }
  validates :commentable, :user, presence: true
  validates :body, presence: true

  after_trash :decrement_counter_cache, :delete_all_notifications
  after_restore :increment_counter_cache
  after_destroy :increment_counter_cache, if: :trashed?

  def increment_counter_cache
    if commentable.has_attribute? :comments_count
      commentable.class.update_counters commentable.id, comments_count: 1
    end
  end

  def decrement_counter_cache
    if commentable.has_attribute? :comments_count
      commentable.class.update_counters commentable.id, comments_count: -1
    end
  end

  def delete_all_notifications
    notifications.delete_all
  end

  def page(per = Comment.default_per_page)
    @page ||= ((commentable.comments.where("id < ?", id).count) / per + 1)
  end

  def mention_users
    return @menton_users if defined?(@menton_users)

    doc = Nokogiri::HTML.fragment(body)
    nodes = doc.css("a.reply_to")
    usernames = nodes.map { |node|
      node.text.gsub '@', ''
    }.flatten.compact.uniq
    @menton_users = User.where(username: usernames)
  end
end
