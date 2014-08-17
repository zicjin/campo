class CteateMatchs < ActiveRecord::Migration
  def change
    create_table :matchs do |t|
      t.datetime :time
      t.integer :type
      t.integer :cap
      t.string :cap_detail
      t.string :title
      t.string :team
      t.string :team_guest
      t.integer :point
      t.integer :point_guest

      t.float :hot, default: 0.0
      t.integer :comments_count, default: 0
      t.integer :likes_count, default: 0

      t.timestamps
    end

    add_index :matchs, :hot
  end
end
