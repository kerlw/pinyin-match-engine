/**
 * 首字母匹配检测
 * @param acronyms 首字母缩写的数组
 * @param keyword 用于匹配的缩写
 * @returns {number} 首次匹配到的位置index
 */
function acronymTest(acronyms, keyword) {
    for (let acronym of acronyms) {
        let matchPos = acronym.indexOf(keyword);
        if (matchPos >= 0)
            return matchPos;
    }
    return -1;
}

/**
 * 全拼匹配检测
 * @param fullPyArrays pyengine中的全拼索引数组
 * @param keyword 用于匹配的拼音
 * @returns {number} 匹配到的拼音个数，相当于汉字字数
 */
function pyMatchTest(fullPyArrays, keyword) {
    if (fullPyArrays.length === 0)
        return 0;

    let pyArray = fullPyArrays[0]
    for (let py of pyArray) {
        if (py.length >= keyword.length) { //TODO 这里或许可以改为 ==，避免不完全匹配
            if (py.indexOf(keyword) === 0)
                return 1
        } else if (keyword.indexOf(py) === 0) {
            let len = pyMatchTest(fullPyArrays.slice(1), keyword.substr(py.length))
            if (len > 0)
                return 1 + len;
        }
    }
    return 0;
}

/**
 * 全拼匹配检测，以首字母优化搜索流程
 * @param acronyms
 * @param fullPys
 * @param keyword 长度大于1的字母字符串
 * @returns {{pos: number, len: number}}
 */
function fullPyMatchTest(acronyms, fullPys, keyword) {
    let searchedPos = []
    for (let acronym of acronyms) {
        // 利用首字母检测keyword[0]的匹配来优化开始检测全拼匹配的位置
        let pos = acronym.indexOf(keyword[0]);
        while (pos !== -1) {
            if (searchedPos.indexOf(pos) === -1) { // 对于多音字，已经搜索过的位置就不再搜索了
                let len = pyMatchTest(fullPys.slice(pos), keyword);
                if (len > 0) {
                    return { pos, len };
                }
                // 将该pos加入已搜索位置数组
                searchedPos.push(pos);
            }
            pos = acronym.indexOf(keyword[0], pos + 1);
        }
    }

    return { pos: -1, len: 0 }
}

/**
 * 建立索引
 * @param   {[string]|[Object]}     data         数据
 * @param    {string|[string]}    indexes       如果 data 为 [Object]，这里需要建立拼音索引 key
 * @param   {array}              dict         词典数据
 */
export default class Engine {
    constructor(data, indexes = [], dict = {}, prefix = '') {
        this.indexes = [];
        this.history = { keyword: '', indexes: [], data: [] };
        this.data = data;
        this.dict = dict;
        this.prefix = prefix;

        // 建立拼音关键词索引
        indexes = typeof indexes === 'string' ? [indexes] : indexes;
        for (const item of data) {
            let keywords = [];

            if (typeof item === 'string') {
                keywords.push(Engine.participle(item, dict, prefix));
            } else {
                for (const key of indexes) {
                    const words = item[key];
                    if (words) {
                        let py = Engine.participle(words, dict, prefix);
                        py.dataKey = key;
                        keywords.push(py);
                    }
                }
            }

            this.indexes.push(keywords);
        }
    }

    /**
     * 查询
     * @param   {string}    keyword     拼音或者关键字
     * @return  {[string]|{Object}}
     */
    query(keyword) {
        keyword = keyword.replace(/\s/g, '').toLowerCase();

        let indexes = this.indexes;
        let data = this.data;
        const history = this.history;
        const result = [];

        // 性能优化：在上一次搜索结果中查询
        if (history.data.length && keyword.indexOf(history.keyword) === 0) {
            indexes = history.indexes;
            data = history.data;
        }

        history.keyword = keyword;
        history.indexes = [];

        for (let index = 0; index < indexes.length; index++) {
            for (let pyIndex of indexes[index]) {
                if (pyIndex.simple.indexOf(this.prefix + keyword) !== -1) {
                    history.indexes.push(indexes[index]);
                    let clone = JSON.parse(JSON.stringify(data[index]))
                    result.push(clone);
                    break;
                }
            }
        }

        history.data = result
        return result;
    }

    strictMatch(keyword) {
        keyword = keyword.replace(/\s/g, '').toLowerCase();

        let indexes = this.indexes;
        let data = this.data;
        const history = this.history;
        const result = [];

        // 性能优化：在上一次搜索结果中查询
        if (history.data.length && keyword.indexOf(history.keyword) === 0) {
            indexes = history.indexes;
            data = history.data;
        }

        history.keyword = keyword;
        history.indexes = [];
        history.data = [];

        for (let index = 0; index < indexes.length; index++) {
            let matchPos = -1;
            let matchType = "";
            let matchLen = 0;
            for (let pyIndex of indexes[index]) {
                // 优先检测首字母匹配
                matchPos = acronymTest(pyIndex.acronyms, keyword)
                if (matchPos !== -1) {
                    matchType = "acronym";
                    matchLen = keyword.length;
                }
                // 没有满足首字母匹配再尝试全拼匹配
                if (matchPos === -1 && keyword.length > 1) {   // keyword长度为1时，首字母匹配无结果更不可能出现全拼匹配
                    let { pos, len } = fullPyMatchTest(pyIndex.acronyms, pyIndex.full, keyword)
                    if (pos !== -1) {
                        matchPos = pos;
                        matchLen = len;
                        matchType = "fullPy"
                    }
                }

                if (matchPos !== -1) {
                    history.indexes.push(indexes[index]);
                    history.data.push(data[index]);

                    let clone = JSON.parse(JSON.stringify(data[index]))
                    clone.matchPos = matchPos;
                    clone.matchLen = matchLen;
                    clone.pyMatchType = matchType;
                    clone.dataKey = pyIndex.dataKey
                    result.push(clone);
                    break;
                }
            }
        }
        return result;
    }

    /**
     * 将内容进行分词
     * @param    {string}          words        目标字符串
     * @param   {Object}          dict         字典
     * @return    {string}
     */
    static participle(words, dict, prefix = '') {
        words = words.replace(/\s/g, '');
        let simple = `${prefix}${words}`;
        let full = [];
        let acronyms = [];
        const keywords = [[], []]

        for (let i = 0; i < words.length; i++) {
            const pinyin = dict[words[i]];
            if (pinyin) {
                keywords[0].push(pinyin);
                if (words.length > 1) {
                    keywords[1].push(pinyin.map(p => p.charAt(0)));
                }
            }
        }

        for (let i = 0; i < 2; i++) {
            const list = Array.from(keywords[i]);

            let current = list.shift();

            while (list.length) {
                const array = [];
                const next = list.shift();
                for (const c of current) {
                    for (const n of next) {
                        array.push(c + n);
                    }
                }
                current = array;
            }

            if (current) {
                simple += `\u0001${prefix}${current.join(`\u0001${prefix}`)}`.toLowerCase();
                if (i == 0) {
                    full = keywords[0]
                } else {
                    acronyms = current
                }
            }
        }

        return { simple: simple, full: full, acronyms: acronyms };
    }
};
