class AddPreviewTo < ActiveRecord::Migration
  def change
    add_column :topics, :preview, :string
    add_column :nba_topics, :preview, :string
    add_column :tennis_topics, :preview, :string
  end
end
