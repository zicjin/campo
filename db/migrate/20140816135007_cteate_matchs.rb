class CteateMatchs < ActiveRecord::Migration
  def change
    create_table :matches do |t|
      t.string :mongo_id, unique: true, null: false
      t.datetime :time
      t.integer :mtype

      t.float :hot, default: 0.0
      t.integer :comments_count, default: 0
      t.integer :likes_count, default: 0

      t.timestamps
    end

    add_index :matches, :hot
  end
end

  # def change
  #   enable_extension :hstore

  #   create_table :matchs do |t|
  #     t.string :mongo_id, unique: true, null: false
  #     t.datetime :time
  #     t.integer :type
  #     t.integer :cap
  #     t.integer :status
  #     t.string :cap_string
  #     t.string :cap_detail
  #     t.string :title
  #     t.string :team
  #     t.string :team_en
  #     t.string :team_guest
  #     t.string :team_guest_en
  #     t.integer :point
  #     t.integer :point_guest
  #     t.hstore :recordings
  #     t.hstore :recordings_mobi
  #     t.hstore :highlights
  #     t.hstore :highlights_mobi

  #     t.float :hot, default: 0.0
  #     t.integer :comments_count, default: 0
  #     t.integer :likes_count, default: 0

  #     t.timestamps
  #   end

  #   add_index :matchs, :hot
  # end