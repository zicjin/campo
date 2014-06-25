class Admin::CategoriesController < Admin::ApplicationController
  before_action :find_category, only: [:show, :edit, :update, :destroy]
  before_action :groups_selector, only: [:show, :new, :edit]

  def index
    @categories = Category.order(topics_count: :desc)
  end

  def show
  end

  def new
    @category = Category.new
  end

  def create
    @category = Category.new category_params

    if @category.save
      flash[:success] = '成功创建分类'
      redirect_to admin_category_path(@category)
    else
      render :new
    end
  end

  def edit
  end

  def update
    if @category.update_attributes category_params
      flash[:success] = '成功更新分类'
      redirect_to admin_category_path(@category)
    else
      render :edit
    end
  end

  def destroy
    @category.destroy
    flash[:success] = '成功彻底删除分类'
    redirect_to admin_categories_path
  end

  private

  def category_params
    params.require(:category).permit(:name, :slug, :group, :description)
  end

  def find_category
    @category = Category.find params[:id]
  end

  def groups_selector
    @groups = Category.groups
  end
end