class AddTopicsCountToCategories < ActiveRecord::Migration
  def change
    add_column :categories, :nba_topics_count, :int, default: 0
    add_column :categories, :tennis_topics_count, :int, default: 0
  end
end