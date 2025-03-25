from flask import Blueprint

# Make sure blueprint registration has proper template folder and static folder
admin = Blueprint(
    'admin', 
    __name__, 
    url_prefix='/admin',  
    template_folder='../templates/admin',
    static_folder='../static'
)

from . import routes
