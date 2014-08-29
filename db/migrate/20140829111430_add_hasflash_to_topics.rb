class AddHasflashToTopics < ActiveRecord::Migration
  def change
    add_column :topics, :hasflash, :boolean
    add_column :nba_topics, :hasflash, :boolean
    add_column :tennis_topics, :hasflash, :boolean
  end
end
