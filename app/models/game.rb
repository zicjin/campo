class Game < ActiveRecord::Base
  include Likeable

  has_many :comments, as: 'commentable'

  # validates :type, :time, presence: true

  after_create :update_hot
  after_touch :update_hot

  def calculate_hot
    order = Math.log10([comments_count, 1].max)
    order + created_at.to_f / 45000
  end

  def update_hot
    # reload because comments_count has been cache in associations
    reload
    update_attribute :hot, calculate_hot
  end

  def total_pages
    (comments_count.to_f / Comment.default_per_page).ceil
  end

end
