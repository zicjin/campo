class SetTopicHasflashDefault < ActiveRecord::Migration
  def change
    change_column :topics, :hasflash, :boolean, default: false
    change_column :nba_topics, :hasflash, :boolean, default: false
    change_column :tennis_topics, :hasflash, :boolean, default: false
  end
end
# 废弃的Migration，有利更新的Migration后可以直接删除本Migration