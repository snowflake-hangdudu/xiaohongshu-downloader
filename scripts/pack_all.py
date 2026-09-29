"""同时打包 Chrome/Edge zip 与 Firefox xpi。"""
from pack import main as pack_chrome
from pack_firefox import main as pack_firefox

if __name__ == '__main__':
    pack_chrome()
    pack_firefox()
