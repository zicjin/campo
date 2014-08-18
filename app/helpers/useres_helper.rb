module UseresHelper
  def user_link(user)
    user_root_path(username: user.username)
  end

  def apps_user_link(user)
    apps_user_root_path(username: user.username)
  end
end
