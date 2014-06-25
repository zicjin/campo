class AddGroupToCategories < ActiveRecord::Migration
  def change
    add_column :categories, :group, :int, default: 0
  end
end